import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

type Role = "STUDENT" | "ADMIN" | "SUPER_ADMIN";

export type Profile = {
  user_id: string;
  full_name: string | null;
  surname: string | null;
  group_code: string | null;
  role: Role;
};

export type SessionRow = {
  id: number;
  title: string;
  session_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  break_minutes: number;
  booking_status: string;
  location_id: number | null;
  location_name: string | null;
  total_slots: number;
  available_slots: number;
  booked_slots: number;
};

export type SlotRow = {
  id: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
};

export type BookingRow = {
  id: number;
  session_id: number;
  slot_id: number;
  student_id: string;
  full_name: string;
  surname: string;
  group_code: string;
  status: string;
  score: number | null;
  admin_note: string | null;
  session_title: string | null;
  session_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location_name: string | null;
};

function toMin(t: string) {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}
function fromMin(n: number) {
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}

async function loadProfile(userId: string): Promise<Profile> {
  const sql = await getSql();
  const existing = await sql<Profile>`select user_id, full_name, surname, group_code, role from profiles where user_id = ${userId}`;
  if (existing[0]) return existing[0];
  const supers = await sql<{ n: number }>`select count(*)::int as n from profiles where role = 'SUPER_ADMIN'`;
  const role: Role = (supers[0]?.n ?? 0) === 0 ? "SUPER_ADMIN" : "STUDENT";
  await sql`insert into profiles (user_id, role) values (${userId}, ${role}) on conflict (user_id) do nothing`;
  const again = await sql<Profile>`select user_id, full_name, surname, group_code, role from profiles where user_id = ${userId}`;
  return again[0];
}

async function requireStaff(userId: string) {
  const p = await loadProfile(userId);
  if (p.role !== "ADMIN" && p.role !== "SUPER_ADMIN") throw new Error("Administrator access required");
  return p;
}

const SESSION_SQL = `
  select s.id, s.title, s.session_date::text as session_date, s.start_time, s.end_time,
    s.duration_minutes, s.break_minutes, s.booking_status, s.location_id,
    l.name as location_name,
    (select count(*)::int from slots sl where sl.session_id = s.id) as total_slots,
    (select count(*)::int from slots sl where sl.session_id = s.id and sl.is_available) as available_slots,
    (select count(*)::int from bookings b where b.session_id = s.id and b.status <> 'CANCELLED') as booked_slots
  from sessions s
  left join locations l on l.id = s.location_id
`;

export const getMe = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => loadProfile(context.userId));

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { full_name: string; surname: string; group_code: string }) => {
    const group = (d.group_code || "").trim();
    if (!d.full_name?.trim() || !d.surname?.trim()) throw new Error("Name and surname are required");
    if (!/^\d{1,4}\.\d{1,3}$/.test(group)) throw new Error("Group code must look like 113.50");
    return { full_name: d.full_name.trim(), surname: d.surname.trim(), group_code: group };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await loadProfile(context.userId);
    await sql`update profiles set full_name = ${data.full_name}, surname = ${data.surname}, group_code = ${data.group_code} where user_id = ${context.userId}`;
    return loadProfile(context.userId);
  });

export const listSessions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((openOnly: boolean) => Boolean(openOnly))
  .handler(async ({ context, data: openOnly }) => {
    const me = await loadProfile(context.userId);
    const sql = await getSql();
    const staff = me.role === "ADMIN" || me.role === "SUPER_ADMIN";
    const where = !staff || openOnly ? "where s.booking_status = 'OPEN'" : "";
    return sql.query<SessionRow>(`${SESSION_SQL} ${where} order by s.session_date, s.start_time`);
  });

export const getSession = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: number) => Number(id))
  .handler(async ({ data: id }) => {
    const sql = await getSql();
    const rows = await sql.query<SessionRow>(`${SESSION_SQL} where s.id = $1`, [id]);
    if (!rows[0]) throw new Error("Session not found");
    const slots = await sql<SlotRow>`select id, start_time, end_time, is_available from slots where session_id = ${id} order by start_time`;
    return { session: rows[0], slots };
  });

export const createSession = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: {
    title: string;
    session_date: string;
    start_time: string;
    end_time: string;
    duration_minutes: number;
    break_minutes: number;
    booking_status: "OPEN" | "CLOSED";
    location_id: number | null;
  }) => d)
  .handler(async ({ context, data }) => {
    await requireStaff(context.userId);
    const start = toMin(data.start_time);
    const end = toMin(data.end_time);
    const dur = Number(data.duration_minutes);
    const brk = Number(data.break_minutes) || 0;
    if (!(end > start) || dur <= 0) throw new Error("End time must be after start, and duration must be positive");
    const slots: [string, string][] = [];
    for (let t = start; t + dur <= end; t += dur + brk) slots.push([fromMin(t), fromMin(t + dur)]);
    if (!slots.length) throw new Error("No slots fit inside that working period");
    const sql = await getSql();
    const inserted = await sql<{ id: number }>`
      insert into sessions (title, session_date, start_time, end_time, duration_minutes, break_minutes, booking_status, location_id, created_by)
      values (${data.title.trim()}, ${data.session_date}, ${fromMin(start)}, ${fromMin(end)}, ${dur}, ${brk}, ${data.booking_status}, ${data.location_id}, ${context.userId})
      returning id`;
    const id = inserted[0].id;
    for (const [a, b] of slots) {
      await sql`insert into slots (session_id, start_time, end_time) values (${id}, ${a}, ${b})`;
    }
    return { id };
  });

export const setBookingOpen = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number; status: "OPEN" | "CLOSED" }) => d)
  .handler(async ({ context, data }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    await sql`update sessions set booking_status = ${data.status} where id = ${data.id}`;
    return { ok: true };
  });

export const myBookings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return sql<BookingRow>`
      select b.id, b.session_id, b.slot_id, b.student_id, b.full_name, b.surname, b.group_code, b.status,
        null::float as score, null::text as admin_note,
        s.title as session_title, s.session_date::text as session_date,
        sl.start_time, sl.end_time, l.name as location_name
      from bookings b
      join sessions s on s.id = b.session_id
      join slots sl on sl.id = b.slot_id
      left join locations l on l.id = s.location_id
      where b.student_id = ${context.userId}
      order by s.session_date desc, sl.start_time`;
  });

export const bookSlot = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { session_id: number; slot_id: number; full_name: string; surname: string; group_code: string }) => {
    if (!/^\d{1,4}\.\d{1,3}$/.test(d.group_code.trim())) throw new Error("Group code must look like 113.50");
    if (!d.full_name.trim() || !d.surname.trim()) throw new Error("Name and surname are required");
    return { ...d, full_name: d.full_name.trim(), surname: d.surname.trim(), group_code: d.group_code.trim() };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const sess = await sql<{ booking_status: string }>`select booking_status from sessions where id = ${data.session_id}`;
    if (!sess[0] || sess[0].booking_status !== "OPEN") throw new Error("Bookings are closed for this session");
    const slot = await sql<{ is_available: boolean; start_time: string }>`select is_available, start_time from slots where id = ${data.slot_id} and session_id = ${data.session_id}`;
    if (!slot[0] || !slot[0].is_available) throw new Error("That time slot is no longer available");
    const dup = await sql<{ id: number }>`select id from bookings where student_id = ${context.userId} and session_id = ${data.session_id} and status in ('BOOKED','IN_PROGRESS')`;
    if (dup[0]) throw new Error("You already have an active booking for this session");
    await sql`update slots set is_available = false where id = ${data.slot_id} and is_available = true`;
    const row = await sql<{ id: number }>`
      insert into bookings (slot_id, session_id, student_id, full_name, surname, group_code)
      values (${data.slot_id}, ${data.session_id}, ${context.userId}, ${data.full_name}, ${data.surname}, ${data.group_code})
      returning id`;
    await sql`insert into notifications (user_id, title, message) values (${context.userId}, ${"Booking confirmed"}, ${"Your speaking test is reserved."})`;
    return { id: row[0].id };
  });

export const cancelMine = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: number) => Number(id))
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    const rows = await sql<{ status: string; slot_id: number }>`select status, slot_id from bookings where id = ${id} and student_id = ${context.userId}`;
    if (!rows[0]) throw new Error("Booking not found");
    if (rows[0].status !== "BOOKED") throw new Error("You can only cancel before the test starts");
    await sql`update bookings set status = 'CANCELLED' where id = ${id}`;
    await sql`update slots set is_available = true where id = ${rows[0].slot_id}`;
    return { ok: true };
  });

export const sessionQueue = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: number) => Number(id))
  .handler(async ({ context, data: id }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    return sql<BookingRow>`
      select b.id, b.session_id, b.slot_id, b.student_id, b.full_name, b.surname, b.group_code, b.status,
        b.score::float as score, b.admin_note,
        s.title as session_title, s.session_date::text as session_date,
        sl.start_time, sl.end_time, l.name as location_name
      from bookings b
      join sessions s on s.id = b.session_id
      join slots sl on sl.id = b.slot_id
      left join locations l on l.id = s.location_id
      where b.session_id = ${id}
      order by sl.start_time`;
  });

export const startTest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: number) => Number(id))
  .handler(async ({ context, data: id }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    const b = await sql<{ student_id: string; status: string }>`select student_id, status from bookings where id = ${id}`;
    if (!b[0] || b[0].status !== "BOOKED") throw new Error("Only a booked test can be started");
    await sql`update bookings set status = 'IN_PROGRESS', actual_start = now() where id = ${id}`;
    await sql`insert into notifications (user_id, title, message) values (${b[0].student_id}, ${"Test started"}, ${"Your speaking test has started. Good luck!"})`;
    return { ok: true };
  });

export const completeTest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number; score: number; note: string }) => {
    if (d.score < 0 || d.score > 9 || Math.round(d.score * 2) !== d.score * 2) throw new Error("Score must be a whole or half band, 0 to 9");
    return d;
  })
  .handler(async ({ context, data }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    const b = await sql<{ student_id: string; status: string }>`select student_id, status from bookings where id = ${data.id}`;
    if (!b[0] || b[0].status !== "IN_PROGRESS") throw new Error("Test must be in progress");
    await sql`update bookings set status = 'COMPLETED', score = ${data.score}, admin_note = ${data.note || null}, actual_end = now() where id = ${data.id}`;
    await sql`insert into notifications (user_id, title, message) values (${b[0].student_id}, ${"Test ended"}, ${"Your speaking test has ended. Thank you!"})`;
    return { ok: true };
  });

export const listResults = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    return sql<BookingRow>`
      select b.id, b.session_id, b.slot_id, b.student_id, b.full_name, b.surname, b.group_code, b.status,
        b.score::float as score, b.admin_note,
        s.title as session_title, s.session_date::text as session_date,
        sl.start_time, sl.end_time, l.name as location_name
      from bookings b
      join sessions s on s.id = b.session_id
      join slots sl on sl.id = b.slot_id
      left join locations l on l.id = s.location_id
      order by s.session_date desc, sl.start_time`;
  });

export const listPeople = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const me = await loadProfile(context.userId);
    if (me.role !== "SUPER_ADMIN") throw new Error("Super Admin only");
    const sql = await getSql();
    return sql<Profile>`select user_id, full_name, surname, group_code, role from profiles order by created_at`;
  });

export const setRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { user_id: string; role: "STUDENT" | "ADMIN" }) => d)
  .handler(async ({ context, data }) => {
    const me = await loadProfile(context.userId);
    if (me.role !== "SUPER_ADMIN") throw new Error("Super Admin only");
    if (data.user_id === context.userId) throw new Error("You cannot change your own Super Admin role");
    const sql = await getSql();
    const target = await sql<{ role: string }>`select role from profiles where user_id = ${data.user_id}`;
    if (!target[0]) throw new Error("User not found");
    if (target[0].role === "SUPER_ADMIN") throw new Error("Cannot modify the Super Admin account");
    await sql`update profiles set role = ${data.role} where user_id = ${data.user_id}`;
    return { ok: true };
  });

export const myNotes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return sql<{ id: number; title: string; message: string; created_at: string }>`
      select id, title, message, created_at::text as created_at from notifications
      where user_id = ${context.userId} order by id desc limit 20`;
  });
