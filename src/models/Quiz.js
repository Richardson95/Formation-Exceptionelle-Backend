import mongoose from 'mongoose';
import { baseSchemaOptions } from './_shared.js';
import { QUIZ_PASS_MARK } from '../constants.js';

const questionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    options: { type: [String], default: [] },
    correct: { type: Number, required: true }, // index into options
  },
  { _id: false }
);

const quizSchema = new mongoose.Schema(
  {
    courseId: { type: String, required: true, index: true },
    lectureId: { type: String, required: true, index: true },
    title: { type: String, default: 'Quiz' },
    passMark: { type: Number, default: QUIZ_PASS_MARK },
    questions: { type: [questionSchema], default: [] },
  },
  baseSchemaOptions()
);

quizSchema.index({ courseId: 1, lectureId: 1 }, { unique: true });

const Quiz = mongoose.model('Quiz', quizSchema);
export default Quiz;
