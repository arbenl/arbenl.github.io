/** @typedef {{week:number,date:string,title:string,weekUrl?:string,lectureUrl?:string|null,labUrl?:string|null}} CourseWeek */
/** @typedef {{timeZone:string,weeks:CourseWeek[]}} CourseSchedule */
/** The next scheduled teaching day stays in focus all day, in the course timezone.
 * @param {CourseSchedule} schedule
 * @param {Date} [now]
 */
export function getCourseMoment(schedule, now = new Date()) {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: schedule.timeZone }).format(now);
  const nextWeek = schedule.weeks.find(week => week.date >= today) ?? null;
  const latestWeek = schedule.weeks.filter(week => week.date <= today).at(-1) ?? null;
  return { today, nextWeek, latestWeek, status: nextWeek ? nextWeek.date === today ? 'today' : 'upcoming' : 'completed' };
}
