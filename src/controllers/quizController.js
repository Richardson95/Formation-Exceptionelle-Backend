import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import Quiz from '../models/Quiz.js';
import Enrollment from '../models/Enrollment.js';

/** Public quiz shape — never leak the correct-answer index. */
function publicQuiz(quiz) {
  return {
    id: quiz.id,
    courseId: quiz.courseId,
    lectureId: quiz.lectureId,
    title: quiz.title,
    passMark: quiz.passMark,
    questions: quiz.questions.map((q) => ({ question: q.question, options: q.options })),
  };
}

export const getQuiz = asyncHandler(async (req, res) => {
  const { courseId, lectureId } = req.params;

  const enrolled = await Enrollment.exists({ userId: req.userId, courseId });
  if (!enrolled && req.user.role !== 'admin') {
    throw ApiError.forbidden('You must be enrolled to take this quiz');
  }

  const quiz = await Quiz.findOne({ courseId, lectureId });
  if (!quiz) throw ApiError.notFound('Quiz not found');
  res.json(publicQuiz(quiz));
});

export const submitQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.quizId);
  if (!quiz) throw ApiError.notFound('Quiz not found');

  const answers = req.body.answers || [];
  let correct = 0;
  quiz.questions.forEach((q, i) => {
    if (answers[i] === q.correct) correct += 1;
  });
  const total = quiz.questions.length || 1;
  const score = Math.round((correct / total) * 100);
  const passed = score >= quiz.passMark;

  res.json({ score, passed, correct, total });
});
