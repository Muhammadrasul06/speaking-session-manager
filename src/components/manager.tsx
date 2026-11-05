import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { UserButton } from "@/lib/auth/gates";
import {
  bookSlot,
  cancelMine,
  completeTest,
  createSession,
  getMe,
  getSession,
  listPeople,
  listResults,
  listSessions,
  myBookings,
  myNotes,
  saveProfile,
  sessionQueue,
  setBookingOpen,
  setRole,
  startTest,
  type BookingRow,
  type Profile,
  type SessionRow,
  type SlotRow,
} from "@/lib/ssm.functions";

type Tab = "home" | "book" | "mine" | "profile" | "notes" | "dash" | "sessions" | "create" | "results" | "people" | "detail";

function Badge({ status }: { status: string }) {
  const map: Record<string, string> = {
    BOOKED: "bg-blue-50 text-[#155EEF]",
    IN_PROGRESS: "bg-amber-50 text-amber-700",
    COMPLETED: "bg-green-50 text-green-700",
    CANCELLED: "bg-slate-100 text-slate-500",
    OPEN: "bg-green-50 text-green-700",
    CLOSED: "bg-slate-100 text-slate-500",
    ADMIN: "bg-blue-50 text-[#155EEF]",
    SUPER_ADMIN: "bg-amber-50 text-amber-700",
    STUDENT: "bg-slate-100 text-slate-500",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${map[status] || "bg-slate-100"}`}>{status.replace("_", " ")}</span>;
}

export function Manager() {
  const { user, isPending } = useCurrentUserState();
  const [me, setMe] = useState<Profile | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [error, setError] = useState("");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [notes, setNotes] = useState<{ id: number; title: string; message: string }[]>([]);
  const [detail, setDetail] = useState<{ session: SessionRow; slots: SlotRow[] } | null>(null);
  const [queue, setQueue] = useState<BookingRow[]>([]);
  const [slotId, setSlotId] = useState<number | null>(null);
  const [form, setForm] = useState({ full_name: "", surname: "", group_code: "" });
  const [create, setCreate] = useState({
    title: "Sunday speaking practice",
    session_date: "",
    start_time: "09:00",
    end_time: "12:00",
    duration_minutes: 15,
    break_minutes: 0,
    booking_status: "OPEN" as "OPEN" | "CLOSED",
    location_id: 1 as number | null,
  });
  const [scoreFor, setScoreFor] = useState<BookingRow | null>(null);
  const [score, setScore] = useState("6.0");
  const [people, setPeople] = useState<Profile[]>([]);
  const [results, setResults] = useState<BookingRow[]>([]);

  const staff = me?.role === "ADMIN" || me?.role === "SUPER_ADMIN";

  async function refresh() {
    const p = await getMe();
    setMe(p);
    setForm({ full_name: p.full_name || "", surname: p.surname || "", group_code: p.group_code || "" });
    const openOnly = p.role === "STUDENT";
    setSessions(await listSessions({ data: openOnly }));
    setBookings(await myBookings());
    setNotes(await myNotes());
  }

  useEffect(() => {
    if (!user) return;
    refresh().catch((e) => setError(e instanceof Error ? e.message : "Could not load"));
  }, [user]);

  if (isPending) return <main className="grid min-h-screen place-items-center text-slate-500">Loading…</main>;
  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-2xl">🎙️</div>
          <h1 className="text-xl font-semibold">Speaking Session Manager</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to book a speaking test or run a session.</p>
          <Link to="/login" className="mt-5 inline-block w-full rounded-lg bg-[#155EEF] py-2.5 font-semibold text-white">
            Sign in
          </Link>
        </div>
      </main>
    );
  }
  if (!me) return <main className="grid min-h-screen place-items-center text-slate-500">{error || "Loading your account…"}</main>;

  const next = bookings.find((b) => b.status === "BOOKED" || b.status === "IN_PROGRESS");

  async function openSession(id: number, asStaff = false) {
    setError("");
    const d = await getSession({ data: id });
    setDetail(d);
    setSlotId(null);
    if (asStaff) setQueue(await sessionQueue({ data: id }));
    setTab("detail");
  }

  return (
    <div className={staff ? "md:flex md:min-h-screen" : "min-h-screen pb-20"}>
      {staff && (
        <aside className="hidden w-56 shrink-0 flex-col bg-[#123B78] text-white md:flex">
          <div className="px-4 py-5 text-sm font-bold">Speaking Session Manager</div>
          {(
            [
              ["dash", "Dashboard"],
              ["sessions", "Sessions"],
              ["create", "Create session"],
              ["results", "Results"],
              ...(me.role === "SUPER_ADMIN" ? [["people", "Users"]] : []),
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button key={id} className={`px-4 py-3 text-left text-sm ${tab === id ? "bg-white/10" : "text-white/80"}`} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
          <div className="mt-auto p-4 text-xs text-white/70">
            {me.role}
            <div className="mt-2"><UserButton /></div>
          </div>
        </aside>
      )}
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{staff ? "Administrator" : `Hello, ${me.full_name || "there"}`}</h1>
            <p className="text-sm text-slate-500">{me.role === "STUDENT" ? "Book and track your speaking tests." : "Sessions, queue, and scores."}</p>
          </div>
          {!staff && <UserButton />}
        </div>
        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        {tab === "home" && !staff && (
          <>
            {next ? (
              <div className="mb-3 rounded-2xl border border-slate-200 border-l-4 border-l-[#155EEF] bg-white p-4">
                <div className="mb-1 flex justify-between"><span className="text-sm text-slate-500">Next session</span><Badge status={next.status} /></div>
                <p className="text-lg font-semibold">{next.session_date} · {next.start_time?.slice(0, 5)}</p>
                <p className="text-sm text-slate-500">{next.session_title}{next.location_name ? ` · ${next.location_name}` : ""}</p>
              </div>
            ) : (
              <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-8 text-center">
                <h2 className="font-semibold">No upcoming session</h2>
                <p className="mb-3 text-sm text-slate-500">Pick an open time slot to reserve your test.</p>
                <button className="rounded-lg bg-[#155EEF] px-4 py-2 font-semibold text-white" onClick={() => setTab("book")}>Book a speaking session</button>
              </div>
            )}
            <button className="mb-4 w-full rounded-lg bg-[#155EEF] py-2.5 font-semibold text-white" onClick={() => setTab("book")}>Book a speaking session</button>
            <h2 className="mb-2 font-semibold">Notifications</h2>
            {notes.length === 0 && <p className="text-sm text-slate-500">Nothing yet.</p>}
            {notes.slice(0, 4).map((n) => (
              <div key={n.id} className="mb-2 rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="text-sm text-slate-500">{n.message}</p>
              </div>
            ))}
          </>
        )}

        {tab === "book" && (
          <>
            <h2 className="mb-3 font-semibold">Available sessions</h2>
            {sessions.filter((s) => s.booking_status === "OPEN").map((s) => (
              <div key={s.id} className="mb-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex justify-between"><strong>{s.session_date}</strong><Badge status="OPEN" /></div>
                <p className="text-sm text-slate-500">{s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)} · {s.duration_minutes} min · {s.available_slots} left</p>
                <p className="text-sm">{s.title}{s.location_name ? ` · ${s.location_name}` : ""}</p>
                <button className="mt-3 w-full rounded-lg bg-[#155EEF] py-2 text-sm font-semibold text-white" onClick={() => openSession(s.id)}>View times</button>
              </div>
            ))}
            {sessions.filter((s) => s.booking_status === "OPEN").length === 0 && <p className="text-sm text-slate-500">No open sessions yet.</p>}
          </>
        )}

        {tab === "detail" && detail && (
          <>
            <button className="mb-2 text-sm font-semibold text-[#155EEF]" onClick={() => setTab(staff ? "sessions" : "book")}>Back</button>
            <h2 className="font-semibold">{detail.session.title}</h2>
            <p className="mb-3 text-sm text-slate-500">{detail.session.session_date} · {detail.session.start_time.slice(0, 5)}–{detail.session.end_time.slice(0, 5)}</p>
            {!staff && (
              <>
                <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {detail.slots.map((sl) => (
                    <button key={sl.id} disabled={!sl.is_available} onClick={() => setSlotId(sl.id)}
                      className={`rounded-lg border px-2 py-3 text-sm font-semibold ${slotId === sl.id ? "border-[#155EEF] bg-[#155EEF] text-white" : sl.is_available ? "border-slate-200 bg-white" : "border-transparent bg-slate-100 text-slate-400"}`}>
                      {sl.start_time.slice(0, 5)}
                    </button>
                  ))}
                </div>
                {slotId && (
                  <form className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4" onSubmit={async (e) => {
                    e.preventDefault();
                    setError("");
                    try {
                      await bookSlot({ data: { session_id: detail.session.id, slot_id: slotId, ...form } });
                      await refresh();
                      setTab("mine");
                    } catch (err) { setError(err instanceof Error ? err.message : "Booking failed"); }
                  }}>
                    <input className="w-full rounded-lg border px-3 py-2" placeholder="Full name" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                    <input className="w-full rounded-lg border px-3 py-2" placeholder="Surname" required value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} />
                    <input className="w-full rounded-lg border px-3 py-2" placeholder="Group code 113.50" required value={form.group_code} onChange={(e) => setForm({ ...form, group_code: e.target.value })} />
                    <button className="w-full rounded-lg bg-[#155EEF] py-2 font-semibold text-white">Confirm booking</button>
                  </form>
                )}
              </>
            )}
            {staff && (
              <>
                <div className="mb-3 flex gap-2">
                  <button className="rounded-lg border px-3 py-2 text-sm" onClick={async () => {
                    await setBookingOpen({ data: { id: detail.session.id, status: detail.session.booking_status === "OPEN" ? "CLOSED" : "OPEN" } });
                    await openSession(detail.session.id, true);
                    await refresh();
                  }}>{detail.session.booking_status === "OPEN" ? "Close bookings" : "Open bookings"}</button>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-slate-500"><th className="p-2">Time</th><th className="p-2">Student</th><th className="p-2">Group</th><th className="p-2">Status</th><th className="p-2">Score</th><th className="p-2"></th></tr></thead>
                    <tbody>
                      {queue.map((b) => (
                        <tr key={b.id} className="border-t border-slate-100">
                          <td className="p-2">{b.start_time?.slice(0, 5)}</td>
                          <td className="p-2">{b.full_name} {b.surname}</td>
                          <td className="p-2">{b.group_code}</td>
                          <td className="p-2"><Badge status={b.status} /></td>
                          <td className="p-2">{b.score ?? "—"}</td>
                          <td className="p-2">
                            {b.status === "BOOKED" && <button className="rounded bg-[#155EEF] px-2 py-1 text-xs text-white" onClick={async () => { await startTest({ data: b.id }); await openSession(detail.session.id, true); }}>Start</button>}
                            {b.status === "IN_PROGRESS" && <button className="rounded bg-[#155EEF] px-2 py-1 text-xs text-white" onClick={() => setScoreFor(b)}>Score</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {queue.length === 0 && <p className="p-4 text-sm text-slate-500">No bookings yet.</p>}
                </div>
              </>
            )}
          </>
        )}

        {tab === "mine" && (
          <>
            <h2 className="mb-3 font-semibold">My bookings</h2>
            {bookings.map((b) => (
              <div key={b.id} className="mb-2 rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex justify-between"><strong>{b.session_date} · {b.start_time?.slice(0, 5)}</strong><Badge status={b.status} /></div>
                <p className="text-sm text-slate-500">{b.session_title}</p>
                {b.status === "BOOKED" && <button className="mt-2 text-sm font-semibold text-red-600" onClick={async () => { await cancelMine({ data: b.id }); await refresh(); }}>Cancel</button>}
              </div>
            ))}
            {bookings.length === 0 && <p className="text-sm text-slate-500">No bookings yet.</p>}
          </>
        )}

        {tab === "profile" && (
          <form className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4" onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            try { setMe(await saveProfile({ data: form })); } catch (err) { setError(err instanceof Error ? err.message : "Save failed"); }
          }}>
            <h2 className="font-semibold">Profile</h2>
            <p className="text-sm text-slate-500">Role: {me.role}. Name and group are required before booking.</p>
            <input className="w-full rounded-lg border px-3 py-2" placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <input className="w-full rounded-lg border px-3 py-2" placeholder="Surname" value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} />
            <input className="w-full rounded-lg border px-3 py-2" placeholder="113.50" value={form.group_code} onChange={(e) => setForm({ ...form, group_code: e.target.value })} />
            <button className="w-full rounded-lg bg-[#155EEF] py-2 font-semibold text-white">Save</button>
          </form>
        )}

        {(tab === "dash" || (tab === "home" && staff)) && (
          <>
            <div className="mb-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border bg-white p-3"><p className="text-xs text-slate-500">Sessions</p><p className="text-2xl font-semibold">{sessions.length}</p></div>
              <div className="rounded-2xl border bg-white p-3"><p className="text-xs text-slate-500">Booked</p><p className="text-2xl font-semibold">{sessions.reduce((a, s) => a + s.booked_slots, 0)}</p></div>
              <div className="rounded-2xl border bg-white p-3"><p className="text-xs text-slate-500">Open</p><p className="text-2xl font-semibold">{sessions.filter((s) => s.booking_status === "OPEN").length}</p></div>
            </div>
            {sessions.slice(0, 6).map((s) => (
              <button key={s.id} className="mb-2 block w-full rounded-2xl border bg-white p-3 text-left" onClick={() => openSession(s.id, true)}>
                <div className="flex justify-between"><strong>{s.title}</strong><Badge status={s.booking_status} /></div>
                <p className="text-sm text-slate-500">{s.session_date} · {s.booked_slots}/{s.total_slots} booked</p>
              </button>
            ))}
          </>
        )}

        {tab === "sessions" && staff && sessions.map((s) => (
          <button key={s.id} className="mb-2 block w-full rounded-2xl border bg-white p-3 text-left" onClick={() => openSession(s.id, true)}>
            <strong>{s.session_date}</strong> · {s.title}
            <p className="text-sm text-slate-500">{s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)} · {s.booked_slots}/{s.total_slots}</p>
          </button>
        ))}

        {tab === "create" && (
          <form className="space-y-2 rounded-2xl border bg-white p-4" onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            try {
              const { id } = await createSession({ data: create });
              await refresh();
              await openSession(id, true);
            } catch (err) { setError(err instanceof Error ? err.message : "Could not create"); }
          }}>
            <h2 className="font-semibold">Create session</h2>
            <input className="w-full rounded-lg border px-3 py-2" value={create.title} onChange={(e) => setCreate({ ...create, title: e.target.value })} />
            <input type="date" required className="w-full rounded-lg border px-3 py-2" value={create.session_date} onChange={(e) => setCreate({ ...create, session_date: e.target.value })} />
            <div className="flex gap-2">
              <input type="time" className="w-full rounded-lg border px-3 py-2" value={create.start_time} onChange={(e) => setCreate({ ...create, start_time: e.target.value })} />
              <input type="time" className="w-full rounded-lg border px-3 py-2" value={create.end_time} onChange={(e) => setCreate({ ...create, end_time: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <input type="number" min={5} className="w-full rounded-lg border px-3 py-2" value={create.duration_minutes} onChange={(e) => setCreate({ ...create, duration_minutes: Number(e.target.value) })} />
              <input type="number" min={0} className="w-full rounded-lg border px-3 py-2" value={create.break_minutes} onChange={(e) => setCreate({ ...create, break_minutes: Number(e.target.value) })} />
            </div>
            <select className="w-full rounded-lg border px-3 py-2" value={create.booking_status} onChange={(e) => setCreate({ ...create, booking_status: e.target.value as "OPEN" | "CLOSED" })}>
              <option value="OPEN">Open bookings</option>
              <option value="CLOSED">Keep closed</option>
            </select>
            <select className="w-full rounded-lg border px-3 py-2" value={create.location_id ?? ""} onChange={(e) => setCreate({ ...create, location_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">No location</option>
              <option value="1">Location A</option>
              <option value="2">Location B</option>
            </select>
            <button className="w-full rounded-lg bg-[#155EEF] py-2 font-semibold text-white">Create session</button>
          </form>
        )}

        {tab === "results" && (
          <div className="overflow-x-auto rounded-2xl border bg-white">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-slate-500"><th className="p-2">Date</th><th className="p-2">Student</th><th className="p-2">Group</th><th className="p-2">Score</th></tr></thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className="border-t"><td className="p-2">{r.session_date}</td><td className="p-2">{r.full_name} {r.surname}</td><td className="p-2">{r.group_code}</td><td className="p-2 font-semibold">{r.score ?? "—"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "people" && me.role === "SUPER_ADMIN" && (
          <div className="space-y-2">
            {people.map((p) => (
              <div key={p.user_id} className="flex items-center justify-between rounded-xl border bg-white p-3 text-sm">
                <div><p className="font-semibold">{p.full_name || p.user_id}</p><p className="text-slate-500">{p.role}</p></div>
                {p.role === "STUDENT" && <button className="rounded bg-[#155EEF] px-2 py-1 text-xs text-white" onClick={async () => { await setRole({ data: { user_id: p.user_id, role: "ADMIN" } }); setPeople(await listPeople()); }}>Promote</button>}
                {p.role === "ADMIN" && <button className="rounded border px-2 py-1 text-xs" onClick={async () => { await setRole({ data: { user_id: p.user_id, role: "STUDENT" } }); setPeople(await listPeople()); }}>Demote</button>}
              </div>
            ))}
          </div>
        )}
      </div>

      {staff ? (
        <nav className="fixed inset-x-0 bottom-0 flex justify-around border-t bg-white py-2 text-xs md:hidden">
          <button onClick={() => setTab("dash")}>Home</button>
          <button onClick={() => setTab("sessions")}>Sessions</button>
          <button onClick={() => setTab("create")}>Create</button>
          <button onClick={async () => { setResults(await listResults()); setTab("results"); }}>Results</button>
        </nav>
      ) : (
        <nav className="fixed inset-x-0 bottom-0 flex justify-around border-t bg-white py-2 text-xs">
          <button onClick={() => setTab("home")}>Home</button>
          <button onClick={() => setTab("book")}>Book</button>
          <button onClick={() => setTab("mine")}>Bookings</button>
          <button onClick={() => setTab("profile")}>Profile</button>
        </nav>
      )}

      {scoreFor && (
        <div className="fixed inset-0 grid place-items-center bg-black/40 p-4" onClick={() => setScoreFor(null)}>
          <form className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()} onSubmit={async (ev) => {
            ev.preventDefault();
            await completeTest({ data: { id: scoreFor.id, score: Number(score), note: "" } });
            setScoreFor(null);
            if (detail) await openSession(detail.session.id, true);
          }}>
            <h2 className="font-semibold">Score for {scoreFor.full_name}</h2>
            <input type="number" step="0.5" min="0" max="9" className="w-full rounded-lg border px-3 py-2" value={score} onChange={(e) => setScore(e.target.value)} />
            <button className="w-full rounded-lg bg-[#155EEF] py-2 font-semibold text-white">Save and end test</button>
          </form>
        </div>
      )}
    </div>
  );
}
