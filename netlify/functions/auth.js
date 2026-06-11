const { supabase, jwt, JWT_SECRET, ok, err, preflight, subPath } = require('./_db');
const bcrypt = require('bcryptjs');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const path = subPath(event, 'auth');
  const body = event.body ? JSON.parse(event.body) : {};

  // POST /api/auth/register
  if (event.httpMethod === 'POST' && path === 'register') {
    const { full_name, email, password, gender, level, subunit_id } = body;
    if (!full_name || !email || !password) return err('Name, email and password required');
    if (password.length < 6) return err('Password must be at least 6 characters');

    const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
    if (existing) return err('Email already registered');

    const password_hash = await bcrypt.hash(password, 10);
    const { data: user, error } = await supabase.from('users').insert({
      full_name, email, password_hash, gender: gender||null, level: level||null,
      subunit_id: subunit_id || null, email_verified: true
    }).select().single();

    if (error) return err(error.message);

    await supabase.from('notifications').insert({
      user_id: user.id, type: 'welcome',
      title: 'Welcome to the Hospitality Unit!',
      message: `Hi ${full_name}, your account has been created. Welcome to Lamak University Chapel Hospitality Unit!`
    });

    const token = jwt.sign({ id: user.id, email: user.email, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
    const { password_hash: _, ...safe } = user;
    return ok({ token, user: safe });
  }

  // POST /api/auth/login
  if (event.httpMethod === 'POST' && path === 'login') {
    const { email, password } = body;
    if (!email || !password) return err('Email and password required');

    const { data: user } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
    if (!user) return err('Invalid email or password');

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return err('Invalid email or password');

    if (user.status === 'Expelled') return err('Your account has been expelled. Contact admin.');
    if (user.status === 'Suspended') return err('Your account is suspended. Contact admin.');

    await supabase.from('users').update({ last_seen: new Date().toISOString() }).eq('id', user.id);

    const token = jwt.sign({ id: user.id, email: user.email, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
    const { password_hash, ...safe } = user;
    return ok({ token, user: safe });
  }

  // POST /api/auth/forgot-password
  if (event.httpMethod === 'POST' && path === 'forgot-password') {
    const { email } = body;
    const { data: user } = await supabase.from('users').select('id,full_name').eq('email', email).maybeSingle();
    if (!user) return ok({ message: 'If that email exists, a reset link has been sent.' });

    const token = Math.random().toString(36).substr(2) + Date.now().toString(36);
    const expires = new Date(Date.now() + 3600000).toISOString();
    await supabase.from('password_resets').insert({ email, token, expires_at: expires });
    return ok({ message: 'Reset link generated!', reset_token: token });
  }

  // POST /api/auth/reset-password
  if (event.httpMethod === 'POST' && path === 'reset-password') {
    const { token, password } = body;
    if (!token || !password) return err('Token and new password required');

    const { data: reset } = await supabase.from('password_resets')
      .select('*').eq('token', token).eq('used', false).maybeSingle();
    if (!reset || new Date(reset.expires_at) < new Date()) return err('Invalid or expired reset token');

    const password_hash = await bcrypt.hash(password, 10);
    await supabase.from('users').update({ password_hash }).eq('email', reset.email);
    await supabase.from('password_resets').update({ used: true }).eq('id', reset.id);
    return ok({ message: 'Password reset successfully' });
  }

  return err('Not found', 404);
};
