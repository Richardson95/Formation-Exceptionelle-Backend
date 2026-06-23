import { Router } from 'express';
import * as ctrl from '../controllers/courseController.js';
import { authRequired, authOptional, instructorOnly, ownerOrAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createCourseSchema,
  updateCourseSchema,
  listCoursesQuerySchema,
  reviewSchema,
} from '../validators/courseValidators.js';
import Course from '../models/Course.js';

const router = Router();

const courseOwner = ownerOrAdmin(async (req) => {
  const course = await Course.findById(req.params.id).select('instructorId');
  return course?.instructorId;
});

router.get('/', authOptional, validate({ query: listCoursesQuerySchema }), ctrl.listCourses);
router.get('/featured', ctrl.featuredCourses);
router.get('/instructor/:instructorId', authOptional, ctrl.instructorCourses);

router.post('/', authRequired, instructorOnly, validate({ body: createCourseSchema }), ctrl.createCourse);

router.get('/:id', authOptional, ctrl.getCourse);
router.patch('/:id', authRequired, courseOwner, validate({ body: updateCourseSchema }), ctrl.updateCourse);
router.delete('/:id', authRequired, courseOwner, ctrl.deleteCourse);

router.get('/:id/reviews', ctrl.listReviews);
router.post('/:id/reviews', authRequired, validate({ body: reviewSchema }), ctrl.createReview);

export default router;
