import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
    getSettings,
    updateSettings,
    getAdminSettings,
    getAllAdmins,
    updateSchedule
} from "../controllers/admin.controller.js";

const router = express.Router();

// All admin routes require authentication
router.use(protect);

/**
 * @route   GET /api/admin/settings
 * @desc    Get current admin's settings
 * @access  Private (Admin only)
 */
router.get("/settings", getSettings);

/**
 * @route   PUT /api/admin/settings
 * @desc    Update current admin's settings
 * @access  Private (Admin only)
 */
router.put("/settings", updateSettings);

/**
 * @route   PATCH /api/admin/schedule
 * @desc    Update only the schedule time
 * @access  Private (Admin only)
 */
router.patch("/schedule", updateSchedule);

/**
 * @route   GET /api/admin/settings/:adminId
 * @desc    Get specific admin's settings
 * @access  Private (Admin only)
 */
router.get("/settings/:adminId", getAdminSettings);

/**
 * @route   GET /api/admin/admins
 * @desc    Get all admins (super admin feature)
 * @access  Private (Admin only)
 */
router.get("/admins", getAllAdmins);

export default router;