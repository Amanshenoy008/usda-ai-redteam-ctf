// Authentication Routes

import express from 'express';

import { authenticate } from '../Middlewares/auth.js';
import {  challenge1,challenge2, challenge3, challenge4 } from '../Controllers/challengesController.js';

const router = express.Router();

/**
 * Private routes
 */
router.post('/challenge1', challenge1 );

router.post('/challenge2', challenge2 );

router.post('/challenge3', challenge3 );

router.post('/challenge4', challenge4 );

//router.post('/challenge5' );



export default router;

