import { Router } from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import sessionRoutes from './sessionRoutes.js';
import conversationRoutes from './conversationRoutes.js';
import calendarRoutes from './calendarRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import requestRoutes from './requestRoutes.js';
import samRoutes from './samRoutes.js';
import requestedPeopleRoutes from './requestedPeopleRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/sessions', sessionRoutes);
router.use('/conversations', conversationRoutes);
router.use('/calendar', calendarRoutes);
router.use('/payments', paymentRoutes);
router.use('/requests', requestRoutes);
router.use('/sam', samRoutes);
router.use('/requested-people', requestedPeopleRoutes);

export default router;
