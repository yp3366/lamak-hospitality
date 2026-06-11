const { supabase, ok, err, verifyToken, preflight, subPath } = require('./_db');
const bcrypt = require('bcryptjs');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const user = await verifyToken(event);
  if (!user) return err('Unauthorized', 401);

  const path = subPath(event, 'users');
  const segments = path.split('/').filter(Boolean);
  const userId = segments[0];
  const action = segments[1];
  const body = event.body ? JSON.parse(event.body) : {};
  const params = event.queryStringParameters || {};

  // GET /api/users — list all
  if (event.httpMethod === 'GET' && !userId) {
    let query = supabase.from('users')
      .select('id,full_name,email,gender,level,role,custom_role,custom_role_color,status,is_admin,profile_pic,join_date,last_seen,subunit_id,subunits(name,color,icon)')
      .order('full_name');
    if (params.status) query = query.eq('status', params.status);
    if (params.subunit) query = query.eq('subunit_id', params.subunit);
    if (params.search) query = query.ilike('full_name', `%${params.search}%`);
    const { data, error } = await query;
    if (error) return err(error.message);
    return ok(data);
  }

  // GET /api/users/stats
  if (event.httpMethod === 'GET' && userId === 'stats') {
    const { data: counts } = await supabase.from('users').select('status');
    const total = counts?.length || 0;
    const active = counts?.filter(u => u.status === 'Active').length || 0;
    const probation = counts?.filter(u => u.status === 'Probation').length || 0;
    const suspended = counts?.filter(u => u.status === 'Suspended').length || 0;
    const expelled = counts?.filter(u => u.status === 'Expelled').length || 0;
    const { data: subunitCount } = await supabase.from('subunits').select('id');
    const { data: att } = await supabase.from('attendance').select('present');
    const attRate = att?.length ? Math.round((att.filter(a => a.present).length / att.length) * 100) : 0;
    return ok({ total, active, probation, suspended, expelled, subunits: subunitCount?.length || 0, attendance_rate: attRate });
  }

  // GET /api/users/:id
  if (event.httpMethod === 'GET' && userId && !action) {
    const { data, error } = await supabase.from('users')
      .select('id,full_name,email,gender,level,role,custom_role,custom_role_color,status,is_admin,profile_pic,banner_image,bio,favorite_verse,skills,profile_color,social_links,join_date,last_seen,subunit_id,subunits(name,color,icon)')
      .eq('id', userId).single();
    if (error) return err('User not found', 404);

    const { data: att } = await supabase.from('attendance').select('present,service_type').eq('user_id', userId);
    const attendance = {
      total: att?.length || 0,
      present: att?.filter(a => a.present).length || 0,
      sunday: att?.filter(a => a.service_type === 'Sunday' && a.present).length || 0,
      tuesday: att?.filter(a => a.service_type === 'Tuesday' && a.present).length || 0,
      thursday: att?.filter(a => a.service_type === 'Thursday' && a.present).length || 0,
      percentage: att?.length ? Math.round((att.filter(a => a.present).length / att.length) * 100) : 0
    };
    return ok({ ...data, attendance });
  }

  // PUT /api/users/:id
  if (event.httpMethod === 'PUT' && userId && !action) {
    if (userId !== user.id && !user.is_admin) return err('Forbidden', 403);

    const adminFields = ['full_name','gender','level','role','custom_role','custom_role_color','subunit_id','status','is_admin','profile_pic','banner_image'];
    const memberFields = ['bio','favorite_verse','skills','profile_color','social_links','profile_pic','banner_image'];
    const allowed = user.is_admin ? [...adminFields, ...memberFields] : memberFields;

    const updates = {};
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }
    if (!Object.keys(updates).length) return err('Nothing to update');

    const { data, error } = await supabase.from('users').update(updates).eq('id', userId).select().single();
    if (error) return err(error.message);

    if (user.is_admin && body.status) {
      await supabase.from('audit_logs').insert({ admin_id: user.id, action: `Changed status to ${body.status}`, target_user_id: userId });
      await supabase.from('status_history').insert({ user_id: userId, new_status: body.status, changed_by: user.id, reason: body.reason || '' });
      await supabase.from('notifications').insert({
        user_id: userId, type: 'status', title: 'Status Updated',
        message: `Your membership status was changed to ${body.status}. ${body.reason ? 'Reason: ' + body.reason : ''}`
      });
    }
    const { password_hash, ...safe } = data;
    return ok(safe);
  }

  // POST /api/users/:id/status
  if (event.httpMethod === 'POST' && action === 'status') {
    if (!user.is_admin) return err('Admin only', 403);
    const { status, reason } = body;
    if (!['Active','Probation','Suspended','Expelled'].includes(status)) return err('Invalid status');

    const { data: old } = await supabase.from('users').select('status').eq('id', userId).single();
    await supabase.from('users').update({ status }).eq('id', userId);
    await supabase.from('status_history').insert({ user_id: userId, old_status: old?.status, new_status: status, reason: reason||'', changed_by: user.id });
    await supabase.from('audit_logs').insert({ admin_id: user.id, action: `Set status to ${status} for user`, target_user_id: userId, details: reason||'' });
    await supabase.from('notifications').insert({
      user_id: userId, type: 'status', title: 'Status Update',
      message: `Your status was changed to ${status}. ${reason ? 'Reason: ' + reason : ''}`
    });
    return ok({ message: 'Status updated' });
  }

  // POST /api/users/:id/role
  if (event.httpMethod === 'POST' && action === 'role') {
    if (!user.is_admin) return err('Admin only', 403);
    const { role, custom_role, custom_role_color } = body;
    await supabase.from('users').update({ role, custom_role, custom_role_color }).eq('id', userId);
    await supabase.from('audit_logs').insert({ admin_id: user.id, action: `Assigned role: ${custom_role || role}`, target_user_id: userId });
    await supabase.from('notifications').insert({
      user_id: userId, type: 'role', title: 'Role Assigned',
      message: `You have been assigned the role: ${custom_role || role}`
    });
    return ok({ message: 'Role updated' });
  }

  // DELETE /api/users/:id
  if (event.httpMethod === 'DELETE' && userId) {
    if (!user.is_admin) return err('Admin only', 403);
    await supabase.from('users').update({ status: 'Expelled' }).eq('id', userId);
    await supabase.from('audit_logs').insert({ admin_id: user.id, action: 'Expelled member', target_user_id: userId });
    return ok({ message: 'Member expelled' });
  }

  return err('Not found', 404);
};
