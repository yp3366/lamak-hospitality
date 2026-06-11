const { supabase, ok, err, verifyToken, preflight, subPath } = require('./_db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const user = await verifyToken(event);
  if (!user) return err('Unauthorized', 401);

  const rawPath = event.path || '';
  const body = event.body ? JSON.parse(event.body) : {};
  const params = event.queryStringParameters || {};

  // Determine which resource we're dealing with
  const resource = ['subunits','announcements','events','messages','notifications'].find(r => rawPath.includes('/' + r));
  if (!resource) return err('Not found', 404);

  const afterResource = rawPath.split('/' + resource)[1] || '';
  const segments = afterResource.split('/').filter(Boolean);
  const itemId = segments[0];
  const action = segments[1];

  // ── SUBUNITS ──────────────────────────────────────────────
  if (resource === 'subunits') {
    if (event.httpMethod === 'GET' && !itemId) {
      const { data, error } = await supabase.from('subunits')
        .select('*,head:head_id(id,full_name,profile_pic),asst:assistant_head_id(id,full_name)')
        .order('name');
      if (error) return err(error.message);
      const { data: members } = await supabase.from('users').select('subunit_id').neq('status','Expelled');
      const result = (data || []).map(s => ({
        ...s,
        member_count: (members || []).filter(m => m.subunit_id === s.id).length
      }));
      return ok(result);
    }
    if (event.httpMethod === 'POST' && !itemId) {
      if (!user.is_admin) return err('Admin only', 403);
      const { name, description, icon, color, is_registration_open } = body;
      if (!name) return err('Name required');
      const { data, error } = await supabase.from('subunits').insert({ name, description, icon: icon||'✦', color: color||'#6c7fff', is_registration_open: is_registration_open !== false }).select().single();
      if (error) return err(error.message);
      await supabase.from('audit_logs').insert({ admin_id: user.id, action: `Created subunit: ${name}` });
      return ok(data);
    }
    if (event.httpMethod === 'PUT' && itemId) {
      if (!user.is_admin) return err('Admin only', 403);
      const { data, error } = await supabase.from('subunits').update(body).eq('id', itemId).select().single();
      if (error) return err(error.message);
      return ok(data);
    }
    if (event.httpMethod === 'DELETE' && itemId) {
      if (!user.is_admin) return err('Admin only', 403);
      await supabase.from('subunits').delete().eq('id', itemId);
      return ok({ message: 'Subunit deleted' });
    }
  }

  // ── ANNOUNCEMENTS ─────────────────────────────────────────
  if (resource === 'announcements') {
    if (event.httpMethod === 'GET') {
      const { data, error } = await supabase.from('announcements')
        .select('*,author:author_id(id,full_name,profile_pic,custom_role)')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) return err(error.message);
      return ok(data);
    }
    if (event.httpMethod === 'POST' && !itemId) {
      if (!user.is_admin) return err('Admin only', 403);
      const { title, content, is_pinned, attachment_url, attachment_type } = body;
      if (!title || !content) return err('Title and content required');
      const { data, error } = await supabase.from('announcements').insert({
        title, content, is_pinned: !!is_pinned, attachment_url, attachment_type, author_id: user.id
      }).select('*,author:author_id(id,full_name,profile_pic,custom_role)').single();
      if (error) return err(error.message);
      // Notify all members
      const { data: allUsers } = await supabase.from('users').select('id').neq('id', user.id).neq('status','Expelled');
      if (allUsers?.length) {
        await supabase.from('notifications').insert(allUsers.map(u => ({
          user_id: u.id, type: 'announcement',
          title: `New Announcement: ${title}`,
          message: content.substr(0, 120)
        })));
      }
      return ok(data);
    }
    if (event.httpMethod === 'PUT' && itemId) {
      if (!user.is_admin) return err('Admin only', 403);
      const { data, error } = await supabase.from('announcements').update(body).eq('id', itemId).select().single();
      if (error) return err(error.message);
      return ok(data);
    }
    if (event.httpMethod === 'DELETE' && itemId) {
      if (!user.is_admin) return err('Admin only', 403);
      await supabase.from('announcements').delete().eq('id', itemId);
      return ok({ message: 'Deleted' });
    }
  }

  // ── EVENTS ────────────────────────────────────────────────
  if (resource === 'events') {
    if (event.httpMethod === 'GET') {
      const { data, error } = await supabase.from('events')
        .select('*,creator:created_by(id,full_name)')
        .gte('event_date', new Date().toISOString())
        .order('event_date').limit(20);
      if (error) return err(error.message);
      return ok(data);
    }
    if (event.httpMethod === 'POST' && !itemId) {
      if (!user.is_admin) return err('Admin only', 403);
      const { title, description, event_date, event_type, location } = body;
      if (!title || !event_date) return err('Title and date required');
      const { data, error } = await supabase.from('events').insert({
        title, description, event_date, event_type: event_type||'Other', location, created_by: user.id
      }).select().single();
      if (error) return err(error.message);
      return ok(data);
    }
    if (event.httpMethod === 'DELETE' && itemId) {
      if (!user.is_admin) return err('Admin only', 403);
      await supabase.from('events').delete().eq('id', itemId);
      return ok({ message: 'Deleted' });
    }
  }

  // ── MESSAGES ──────────────────────────────────────────────
  if (resource === 'messages') {
    const channel = params.channel || 'general';

    if (event.httpMethod === 'GET' && !itemId) {
      const { data, error } = await supabase.from('messages')
        .select('*,sender:user_id(id,full_name,profile_pic,custom_role,custom_role_color,role)')
        .eq('channel', channel).eq('is_deleted', false)
        .order('created_at', { ascending: false }).limit(60);
      if (error) return err(error.message);
      return ok((data || []).reverse());
    }
    if (event.httpMethod === 'POST' && !itemId) {
      const { content, channel: ch, image_url, reply_to } = body;
      if (!content && !image_url) return err('Content required');
      const { data, error } = await supabase.from('messages').insert({
        user_id: user.id, content: content||'', channel: ch||'general', image_url, reply_to
      }).select('*,sender:user_id(id,full_name,profile_pic,custom_role,custom_role_color,role)').single();
      if (error) return err(error.message);
      return ok(data);
    }
    if (event.httpMethod === 'DELETE' && itemId) {
      const { data: msg } = await supabase.from('messages').select('user_id').eq('id', itemId).single();
      if (msg?.user_id !== user.id && !user.is_admin) return err('Forbidden', 403);
      await supabase.from('messages').update({ is_deleted: true, content: '[deleted]' }).eq('id', itemId);
      return ok({ message: 'Deleted' });
    }
    if (event.httpMethod === 'PUT' && itemId) {
      const { data: msg } = await supabase.from('messages').select('user_id').eq('id', itemId).single();
      if (msg?.user_id !== user.id) return err('Forbidden', 403);
      const { data, error } = await supabase.from('messages').update({
        content: body.content, edited_at: new Date().toISOString()
      }).eq('id', itemId).select().single();
      if (error) return err(error.message);
      return ok(data);
    }
  }

  // ── NOTIFICATIONS ─────────────────────────────────────────
  if (resource === 'notifications') {
    if (event.httpMethod === 'GET') {
      const { data, error } = await supabase.from('notifications')
        .select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(30);
      if (error) return err(error.message);
      const unread = (data || []).filter(n => !n.is_read).length;
      return ok({ notifications: data || [], unread });
    }
    if (event.httpMethod === 'PUT') {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
      return ok({ message: 'All marked read' });
    }
  }

  return err('Not found', 404);
};
