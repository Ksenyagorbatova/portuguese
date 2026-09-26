// localStorage-флаг «финал курса уже видели»: CourseComplete показывается один
// раз на устройстве (читает и пишет Session). Флаг выводится из прогресса
// аккаунта, поэтому удаление аккаунта его стирает — новый аккаунт на этом
// устройстве снова увидит финал, когда закроет курс.
export const COURSE_SEEN_KEY = "pt-course-complete-seen";

export function forgetCourseSeen(): void {
  try {
    localStorage.removeItem(COURSE_SEEN_KEY);
  } catch {
    // хранилище недоступно — флаг тогда и не сохранялся
  }
}
