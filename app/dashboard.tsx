"use client";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BusFront,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleAlert,
  MapPin,
  MessageSquareText,
  Search,
  Send,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Day = "월" | "화" | "수" | "목" | "금";
type SlotId = "09-in" | "15-in" | "15-out" | "1630-in" | "1630-out" | "18-out";
type ChangeType = "결석" | "개별등원" | "개별하원" | "시간변경" | "장소변경";
type Ride = {
  id: string;
  bus: number;
  slot: SlotId;
  days: Day[];
  time: string;
  stop: string;
  student: string;
  englishName?: string | null;
};
type Change = {
  id: string;
  date: string;
  student: string;
  group: string;
  type: ChangeType;
  detail: string;
  source: string;
  confirmed?: boolean;
};
type SearchDetail = { kind: "student" | "place"; value: string } | null;

const days: Day[] = ["월", "화", "수", "목", "금"];
const buses = [1, 2, 3, 5, 6];
const slots: {
  id: SlotId;
  time: string;
  label: string;
  group: string;
  direction: "in" | "out";
}[] = [
  {
    id: "09-in",
    time: "09:00",
    label: "9시 등원",
    group: "오전유치부",
    direction: "in",
  },
  {
    id: "15-in",
    time: "15:00",
    label: "3시 등원",
    group: "초등부",
    direction: "in",
  },
  {
    id: "1630-in",
    time: "16:30",
    label: "4시 30분 등원",
    group: "오후유치부 · 초등부",
    direction: "in",
  },
  {
    id: "15-out",
    time: "15:00",
    label: "3시 하원",
    group: "오전유치부",
    direction: "out",
  },
  {
    id: "1630-out",
    time: "16:30",
    label: "4시 30분 하원",
    group: "방과후 · 오후유치부 · 초등부",
    direction: "out",
  },
  {
    id: "18-out",
    time: "18:00",
    label: "6시 하원",
    group: "데이케어 · 오후유치부 · 초등부",
    direction: "out",
  },
];
const dayIndex: Record<Day, number> = { 월: 1, 화: 2, 수: 3, 목: 4, 금: 5 };
function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function initialDate() {
  const d = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  );
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2);
  return iso(d);
}
function dayOf(value: string): Day {
  const n = new Date(`${value}T12:00:00`).getDay();
  return days[Math.max(0, Math.min(4, n - 1))];
}
function parseQuick(
  text: string,
  baseDate: string,
): Omit<Change, "id">[] | null {
  const date = text.match(
    /(\d{1,2})\s*[./-]\s*(\d{1,2})(?:\s*[~～-]\s*(?:(\d{1,2})\s*[./-]\s*)?(\d{1,2}))?/,
  );
  const types = (
    ["개별등원", "개별하원", "시간변경", "장소변경", "결석"] as ChangeType[]
  ).filter((v) => text.includes(v));
  const groups = ["오전유치부", "오후유치부", "초등부", "데이케어", "방과후"];
  const group = groups.find((v) => text.includes(v));
  if (!date || types.length === 0) return null;
  const before = text.slice(0, date.index).trim();
  let student = before;
  groups.forEach((g) => {
    student = student.replace(g, "").trim();
  });
  student = student.replace(/오늘|내일|학생/g, "").trim();
  if (!student) return null;
  const year = Number(baseDate.slice(0, 4));
  const start = new Date(year, Number(date[1]) - 1, Number(date[2]));
  const end = new Date(
    year,
    Number(date[3] || date[1]) - 1,
    Number(date[4] || date[2]),
  );
  if (end < start) return null;
  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end && dates.length < 32) {
    dates.push(iso(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates.flatMap((day) =>
    types.map((type) => ({
      date: day,
      student,
      group: group || "미분류",
      type,
      detail: `${type}으로 처리`,
      source: text,
      confirmed: false,
    })),
  );
}

export default function Dashboard({
  user,
}: {
  user: { name: string; signOut: string };
}) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedDirection, setSelectedDirection] = useState<"out" | "in">(
    "out",
  );
  const [query, setQuery] = useState("");
  const [quick, setQuick] = useState("");
  const [message, setMessage] = useState("");
  const [changes, setChanges] = useState<Change[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [searchDetail, setSearchDetail] = useState<SearchDetail>(null);
  const selectedDay = dayOf(selectedDate);
  useEffect(() => {
    fetch("/api/schedule")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) =>
        setRides(
          data.rides.map((r: Ride & { day: Day }) => ({ ...r, days: [r.day] })),
        ),
      )
      .catch(() => setMessage("기본 시간표를 불러오지 못했습니다."));
  }, []);
  useEffect(() => {
    fetch(`/api/changes?date=${selectedDate}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) =>
        setChanges(
          data.changes.map((c: Change & { groupName?: string }) => ({
            ...c,
            group: c.groupName || "미분류",
          })),
        ),
      )
      .catch(() => setMessage("공동 저장소에 연결하지 못했습니다."));
  }, [selectedDate]);
  const dateChanges = changes.filter((c) => c.date === selectedDate);
  const relevantChanges = dateChanges.filter((c) =>
    selectedDirection === "out"
      ? !c.type.includes("등원")
      : !c.type.includes("하원"),
  );
  function pickDay(day: Day) {
    const d = new Date(`${selectedDate}T12:00:00`);
    d.setDate(d.getDate() + dayIndex[day] - d.getDay());
    setSelectedDate(iso(d));
  }
  async function submitQuick() {
    const parsed = parseQuick(quick, selectedDate);
    if (!parsed) {
      setMessage("날짜와 변동 유형을 찾지 못했어요. 예시처럼 입력해 주세요.");
      return;
    }
    const response = await fetch("/api/changes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        changes: parsed.map(({ group, ...item }) => ({
          ...item,
          groupName: group,
        })),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "등록하지 못했습니다.");
      return;
    }
    setChanges((p) => [
      ...p,
      ...data.changes.map((item: Change & { groupName?: string }) => ({
        ...item,
        group: item.groupName || "미분류",
      })),
    ]);
    setSelectedDate(parsed[0].date);
    setSelectedDirection(
      parsed.some((item) => item.type.includes("하원")) ? "out" : "in",
    );
    setQuick("");
    setMessage(`${parsed[0].student} 변동 ${parsed.length}건 등록 완료`);
  }
  async function toggleConfirm(change: Change) {
    const confirmed = !change.confirmed;
    setChanges((p) =>
      p.map((x) => (x.id === change.id ? { ...x, confirmed } : x)),
    );
    const response = await fetch("/api/changes", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: change.id, confirmed }),
    });
    if (!response.ok)
      setChanges((p) =>
        p.map((x) =>
          x.id === change.id ? { ...x, confirmed: !confirmed } : x,
        ),
      );
  }
  async function removeChange(id: string) {
    const previous = changes;
    setChanges((p) => p.filter((x) => x.id !== id));
    const response = await fetch(`/api/changes?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!response.ok) setChanges(previous);
  }
  const filtered = useMemo(
    () => rides.filter((r) => r.days.includes(selectedDay)),
    [rides, selectedDay],
  );
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { students: [] as string[], places: [] as string[] };
    const students = [
      ...new Set(
        rides
          .filter((r) =>
            `${r.student} ${r.englishName || ""}`.toLowerCase().includes(q),
          )
          .map((r) => r.student),
      ),
    ].slice(0, 6);
    const places = [
      ...new Set(
        rides
          .filter((r) => r.stop.toLowerCase().includes(q))
          .map((r) => r.stop),
      ),
    ].slice(0, 6);
    return { students, places };
  }, [query, rides]);
  const detailRides = useMemo(() => {
    if (!searchDetail) return [];
    const order = new Map(slots.map((slot, index) => [slot.id, index]));
    return rides
      .filter((r) =>
        searchDetail.kind === "student"
          ? r.student === searchDetail.value
          : r.stop === searchDetail.value,
      )
      .sort(
        (a, b) =>
          dayIndex[a.days[0]] - dayIndex[b.days[0]] ||
          (order.get(a.slot) || 0) - (order.get(b.slot) || 0) ||
          a.time.localeCompare(b.time) ||
          a.bus - b.bus,
      );
  }, [rides, searchDetail]);
  const visibleSlots = slots.filter((s) => s.direction === selectedDirection);
  function rideFor(change: Change) {
    return filtered.find(
      (r) =>
        r.student === change.student &&
        visibleSlots.some((s) => s.id === r.slot),
    );
  }
  function openSearchDetail(kind: "student" | "place", value: string) {
    setSearchDetail({ kind, value });
  }
  function jumpToRide(ride: Ride) {
    const slot = slots.find((item) => item.id === ride.slot);
    if (slot) setSelectedDirection(slot.direction);
    pickDay(ride.days[0]);
    setSearchDetail(null);
    setQuery("");
    window.setTimeout(
      () =>
        document
          .getElementById(`ride-${ride.id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      120,
    );
  }
  return (
    <main className="board-shell">
      <header className="board-header">
        <div className="brand">
          <span className="brand-icon">
            <BusFront size={20} />
          </span>
          <h1>셔틀버스 대시보드</h1>
        </div>
        <div className="search-box">
          <Search size={16} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="학생 또는 장소 검색"
          />
          {query.trim() && (
            <div className="search-results">
              {searchResults.students.length > 0 && (
                <div className="search-group">
                  <span>학생</span>
                  {searchResults.students.map((student) => (
                    <button
                      key={student}
                      onClick={() => openSearchDetail("student", student)}
                    >
                      <strong>{student}</strong>
                      <small>주간 등·하원 보기</small>
                    </button>
                  ))}
                </div>
              )}
              {searchResults.places.length > 0 && (
                <div className="search-group">
                  <span>장소</span>
                  {searchResults.places.map((place) => (
                    <button
                      key={place}
                      onClick={() => openSearchDetail("place", place)}
                    >
                      <strong>{place}</strong>
                      <small>호차·시간 보기</small>
                    </button>
                  ))}
                </div>
              )}
              {searchResults.students.length === 0 &&
                searchResults.places.length === 0 && (
                  <div className="search-empty">검색 결과가 없습니다.</div>
                )}
            </div>
          )}
        </div>
        <a className="account-link" href={user.signOut}>
          {user.name}
        </a>
      </header>
      <section className="control-bar">
        <div className="date-control">
          <CalendarDays size={17} />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
        <Tabs value={selectedDay} onValueChange={(v) => pickDay(v as Day)}>
          <TabsList className="weekday-tabs">
            {days.map((d) => (
              <TabsTrigger key={d} value={d}>
                {d}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="direction-tabs">
          <button
            className={selectedDirection === "out" ? "active" : ""}
            onClick={() => setSelectedDirection("out")}
          >
            하원 보기
          </button>
          <button
            className={selectedDirection === "in" ? "active" : ""}
            onClick={() => setSelectedDirection("in")}
          >
            등원 보기
          </button>
        </div>
      </section>
      <section className="quick-inbox">
        <div className="quick-label">
          <MessageSquareText size={18} />
          <div>
            <strong>변동사항 빠른 입력</strong>
            <span>
              오전유치부 홍길동 9/1 개별하원 · 오전유치부 홍길동 9/20~23 결석 ·
              오후유치부 홍길순 9/2 개별등원, 개별하원
            </span>
          </div>
        </div>
        <div className="quick-entry">
          <Input
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitQuick();
            }}
            placeholder="예: 오전유치부 홍길동 9/1 개별하원"
          />
          <Button onClick={submitQuick}>
            <Send size={15} /> 등록
          </Button>
        </div>
        {message && (
          <div
            className={`parse-message ${message.includes("완료") ? "ok" : "error"}`}
          >
            {message.includes("완료") ? (
              <CheckCircle2 size={14} />
            ) : (
              <AlertCircle size={14} />
            )}{" "}
            {message}
          </div>
        )}
      </section>
      <section className="priority-panel">
        <div className="priority-heading">
          <div>
            <CircleAlert size={18} />
            <strong>오늘 꼭 확인</strong>
            <Badge>{relevantChanges.length}</Badge>
          </div>
          <span>변동 학생은 원래 호차 명단에도 그대로 표시됩니다.</span>
        </div>
        {relevantChanges.length === 0 ? (
          <div className="no-changes">
            오늘 등록된 {selectedDirection === "out" ? "하원" : "등원"} 변동이
            없습니다.
          </div>
        ) : (
          <div className="priority-grid">
            {relevantChanges.map((c) => {
              const ride = rideFor(c);
              return (
                <article
                  className={`priority-card ${c.confirmed ? "confirmed" : ""}`}
                  key={c.id}
                >
                  <div className="priority-main">
                    <div className="change-type">{c.type}</div>
                    <strong>{c.student}</strong>
                    <p>{c.detail}</p>
                  </div>
                  <div className="assignment">
                    <span>
                      {ride
                        ? slots.find((s) => s.id === ride.slot)?.label
                        : "시간 미확인"}
                    </span>
                    <strong>{ride ? `${ride.bus}호차` : "호차 미확인"}</strong>
                  </div>
                  <button
                    className="confirm-button"
                    onClick={() => toggleConfirm(c)}
                  >
                    {c.confirmed ? (
                      <>
                        <Check size={13} /> 확인완료
                      </>
                    ) : (
                      "확인하기"
                    )}
                  </button>
                  <button
                    className="remove-change"
                    onClick={() => removeChange(c.id)}
                    aria-label="변동 삭제"
                  >
                    <X size={13} />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <section className="schedule-board">
        {visibleSlots.map((slot) => {
          const slotRides = filtered.filter((r) => r.slot === slot.id);
          const slotChanges = dateChanges.filter((c) =>
            slotRides.some((r) => r.student === c.student),
          );
          return (
            <article className="schedule-section" key={slot.id}>
              <div className="section-divider">
                <span>{slot.label}</span>
                <small>
                  {slotRides.length}명
                  {slotChanges.length > 0 && ` · 변동 ${slotChanges.length}건`}
                </small>
              </div>
              <div className="bus-columns">
                {buses.map((bus) => {
                  const list = slotRides.filter((r) => r.bus === bus);
                  return (
                    <div className="bus-column" key={bus}>
                      <div className="bus-title">
                        <span>{bus}호차</span>
                        <small>{list.length}명</small>
                      </div>
                      <div className="student-list">
                        {list.length === 0 ? (
                          <div className="no-route">운행 없음</div>
                        ) : (
                          list.map((r) => {
                            const change = dateChanges.find(
                              (c) => c.student === r.student,
                            );
                            return (
                              <div
                                id={`ride-${r.id}`}
                                className={`student-line ${change ? "changed" : ""}`}
                                key={r.id}
                              >
                                <time>{r.time}</time>
                                <div>
                                  <strong>
                                    {r.student}
                                    {r.englishName && (
                                      <small className="english-name">
                                        {" "}
                                        {r.englishName}
                                      </small>
                                    )}
                                  </strong>
                                  <span>
                                    <MapPin size={10} />
                                    {r.stop}
                                  </span>
                                  {change && (
                                    <div className="inline-change">
                                      <b>{change.type}</b>
                                      <em>{change.detail}</em>
                                      {change.confirmed && (
                                        <i>
                                          <Check size={9} />
                                          확인
                                        </i>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </section>
      <Dialog
        open={Boolean(searchDetail)}
        onOpenChange={(open) => !open && setSearchDetail(null)}
      >
        <DialogContent className="route-dialog">
          <DialogHeader>
            <DialogTitle>{searchDetail?.value}</DialogTitle>
            <DialogDescription>
              {searchDetail?.kind === "student"
                ? "월요일부터 금요일까지 등록된 등·하원 정보입니다."
                : "이 장소를 이용하는 요일·호차·시간 정보입니다."}
            </DialogDescription>
          </DialogHeader>
          <div className="route-detail-list">
            {detailRides.map((ride) => {
              const slot = slots.find((item) => item.id === ride.slot);
              return (
                <button
                  className="route-detail-row"
                  key={ride.id}
                  onClick={() => jumpToRide(ride)}
                >
                  <span className="route-day">{ride.days[0]}</span>
                  <div className="route-detail-main">
                    <strong>{slot?.label}</strong>
                    <span>
                      {searchDetail?.kind === "student"
                        ? ride.stop
                        : `${ride.student}${ride.englishName ? ` ${ride.englishName}` : ""}`}
                    </span>
                  </div>
                  <div className="route-detail-meta">
                    <strong>{ride.bus}호차</strong>
                    <span>{ride.time}</span>
                  </div>
                  <small>명단으로 이동</small>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
