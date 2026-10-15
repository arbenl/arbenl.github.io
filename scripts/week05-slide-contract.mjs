// Every answer reveal needs an explicit student-facing question.
export function validateSlideQuestions(slides, label) {
 for (const [index, slide] of slides.entries()) {
  if (slide.answer && (typeof slide.question !== 'string' || !slide.question.trim().endsWith('?')))
   throw new Error(`${label} slide ${index + 1} needs a question before its answer reveal.`);
  if (slide.quiz && (typeof slide.quiz.question !== 'string' || !slide.quiz.question.trim().endsWith('?')))
   throw new Error(`${label} slide ${index + 1} needs a question for its quiz reveal.`);
 }
}
