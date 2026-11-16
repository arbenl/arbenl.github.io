"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import courseSchedule from "../lib/attendance/course-schedule.json";
import { getCourseMoment } from "../lib/attendance/course-lifecycle.mjs";
import { SemesterAdmin } from "./semester-admin";

export function StaffWorkspace({initialNow,initialSessionId}: {initialNow:string;initialSessionId?:string}) {
  // Start with the server-rendered instant so hydration stays stable at midnight.
  const [clock,setClock]=useState(()=>new Date(initialNow));
  useEffect(()=>{
    const update=()=>setClock(new Date());
    const timer=setInterval(update,60_000);
    const visible=()=>{if(!document.hidden)update();};
    document.addEventListener("visibilitychange",visible);
    return ()=>{clearInterval(timer);document.removeEventListener("visibilitychange",visible);};
  },[]);
  const moment=getCourseMoment(courseSchedule,clock);
  const focus=moment.nextWeek;
  const site="https://arbenl.github.io";
  return <>
      {focus ? <section className="admin-section course-focus" data-focus-week={focus.week} aria-labelledby="staff-focus-title">
        <p className="eyebrow">{moment.status === "today" ? "Sot" : "Ora e radhës"} · {focus.date.split("-").reverse().join(".")}</p>
        <h2 id="staff-focus-title">Java {focus.week} · {focus.title}</h2>
        <nav className="course-actions" aria-label="Materialet e orës së radhës">
          <a className="admin-link" href={site + focus.weekUrl}>Hap javën {focus.week}</a>
          {focus.lectureUrl && <a className="secondary-link" href={site + focus.lectureUrl}>Ligjërata</a>}
          {focus.labUrl && <a className="secondary-link" href={site + focus.labUrl}>Ushtrimet</a>}
          {focus.week === 7 && <Link className="admin-link" href="/staff/colloquium">Kolokviumi I · Grupet dhe fillimi</Link>}
        </nav>
        {!focus.lectureUrl && <p>Plani i javës është publikuar. Prezantimi ende nuk është shtuar.</p>}
      </section> : <section className="admin-section"><h2>Orari i semestrit përfundoi</h2><p>Regjistrat, rezultatet dhe materialet mbeten të arritshme nga kalendari dhe historiku.</p></section>}
      <details className="admin-section course-history">
        <summary>Historiku · Vlerësimet dhe materialet e javëve të kaluara</summary>
        <nav className="course-actions" aria-label="Historiku i lëndës">
          <Link className="secondary-link" href="/staff/colloquium#cq-results">Kolokviumi I · Java 7 · Rezultatet dhe grupet</Link>
          <Link className="secondary-link" href="/staff/colloquium/preview">Provë private e Kolokviumit I</Link>
          <Link className="secondary-link" href="/staff/materials/week-07">Java 7 · Arkiva e materialeve të profesorit</Link>
          <a className="secondary-link" href={site + "/lendet/2026-2027/mobile/syllabusi-2026-2027.html#java-14"}>Kolokviumi II · Java 14 · Plani në syllabus</a>
        </nav>
      </details>
    <SemesterAdmin key={initialSessionId} initialSessionId={initialSessionId} nowIso={clock.toISOString()} />
  </>;
}
