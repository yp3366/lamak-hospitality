const { supabase, ok, err, verifyToken, preflight, subPath } = require('./_db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const user = await verifyToken(event);
  if (!user) return err('Unauthorized', 401);

  const path = subPath(event, 'attendance');
  const segments = path.split('/').filter(Boolean);
  const sub = segments[0];
  const body = event.body ? JSON.parse(event.body) : {};
  const params = event.queryStringParameters || {};

  // GET /api/attendance
  if (event.httpMethod === 'GET' && !sub) {
    let query = supabase.from('attendance')
      .select('id,date,service_type,present,created_at,users(id,full_name,level,subunit_id,subunits(name))')
      .order('date', { ascending: false });
    if (params.user_id) query = query.eq('user_id', params.user_id);
    if (params.date) query = query.eq('date', params.date);
    if (params.service_type) query = query.eq('service_type', params.service_type);
    if (params.month) query = query.gte('date', params.month + '-01').lte('date', params.month + '-31');
    const { data, error } = await query.limit(500);
    if (error) return err(error.message);
    return ok(data);
  }

  // GET /api/attendance/summary
  if (event.httpMethod === 'GET' && sub === 'summary') {
    const { data: users } = await supabase.from('users')
      .select('id,full_name,level,status,subunit_id,subunits(name)')
      .neq('status', 'Expelled');
    const { data: att } = await supabase.from('attendance').select('user_id,present,service_type,date');
    const summary = (users || []).map(u => {
      const records = (att || []).filter(a => a.user_id === u.id);
      const present = records.filter(a => a.present).length;
      const total = records.length;
      return {
        ...u,
        total_sessions: total,
        total_present: present,
        percentage: total ? Math.round((present / total) * 100) : 0,
        sunday: records.filter(a => a.service_type === 'Sunday' && a.present).length,
        tuesday: records.filter(a => a.service_type === 'Tuesday' && a.present).length,
        thursday: records.filter(a => a.service_type === 'Thursday' && a.present).length,
      };
    });
    return ok(summary);
  }

  // GET /api/attendance/today
  if (event.httpMethod === 'GET' && sub === 'today') {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('attendance').select('user_id,present,service_type').eq('date', today);
    const { data: total } = await supabase.from('users').select('id').eq('status', 'Active');
    return ok({
      date: today,
      records: data || [],
      present_count: (data || []).filter(a => a.present).length,
      total_active: total?.length || 0
    });
  }

  // POST /api/attendance/mark
  if (event.httpMethod === 'POST' && sub === 'mark') {
    if (!user.is_admin) return err('Admin only', 403);
    const { user_id, date, service_type, present } = body;
    if (!user_id || !date || !service_type) return err('user_id, date, service_type required');
    const { data, error } = await supabase.from('attendance').upsert(
      { user_id, date, service_type, present: present !== false, marked_by: user.id },
      { onConflict: 'user_id,date,service_type' }
    ).select().single();
    if (error) return err(error.message);
    return ok(data);
  }

  // POST /api/attendance/bulk
  if (event.httpMethod === 'POST' && sub === 'bulk') {
    if (!user.is_admin) return err('Admin only', 403);
    const { records, date, service_type } = body;
    if (!records?.length || !date || !service_type) return err('records, date, service_type required');
    const inserts = records.map(r => ({
      user_id: r.user_id, date, service_type,
      present: r.present !== false, marked_by: user.id
    }));
    const { error } = await supabase.from('attendance').upsert(inserts, { onConflict: 'user_id,date,service_type' });
    if (error) return err(error.message);
    await supabase.from('audit_logs').insert({
      admin_id: user.id,
      action: `Bulk attendance: ${inserts.length} records for ${date} (${service_type})`
    });
    return ok({ message: `${inserts.length} records imported` });
  }

  // GET /api/attendance/chart
  if (event.httpMethod === 'GET' && sub === 'chart') {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push(d.toISOString().substr(0, 7));
    }
    const chartData = await Promise.all(months.map(async m => {
      const start = m + '-01';
      const end = m + '-31';
      const { data } = await supabase.from('attendance').select('present').gte('date', start).lte('date', end);
      const total = data?.length || 0;
      const present = data?.filter(a => a.present).length || 0;
      return { month: m, rate: total ? Math.round((present / total) * 100) : 0, total, present };
    }));
    return ok(chartData);
  }

  return err('Not found', 404);
};
