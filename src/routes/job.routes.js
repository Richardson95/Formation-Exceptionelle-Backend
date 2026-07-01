import { Router } from 'express';
import * as ctrl from '../controllers/jobController.js';
import { authRequired, adminOnly, ownerOrAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createJobSchema, updateJobSchema, listJobsQuerySchema } from '../validators/jobValidators.js';
import Job from '../models/Job.js';

const router = Router();

const jobOwner = ownerOrAdmin(async (req) => {
  const job = await Job.findById(req.params.id).select('postedBy');
  return job?.postedBy;
});

router.get('/', authRequired, validate({ query: listJobsQuerySchema }), ctrl.listJobs);
router.get('/featured', authRequired, ctrl.featuredJobs);
router.get('/internships', authRequired, ctrl.internships);
router.get('/mine', authRequired, ctrl.myJobs); // employer's own postings (any status)
// Only an admin posts jobs, and they go live immediately (no approval step).
router.post('/', authRequired, adminOnly, validate({ body: createJobSchema }), ctrl.createJob);
router.get('/:id', authRequired, ctrl.getJob);
router.patch('/:id', authRequired, jobOwner, validate({ body: updateJobSchema }), ctrl.updateJob);
router.delete('/:id', authRequired, jobOwner, ctrl.deleteJob);

export default router;
