import Admin from "../models/admin.model.js";
import { logger } from "../utils/logger.js";
import { rescheduleDailyVideoJob } from "../jobs/dailyVideo.job.js";

/**
 * Get admin settings
 * GET /api/admin/settings
 * Access: Private (Admin only)
 */
export const getSettings = async (req, res) => {
    try {
        const adminId = req.admin.id; // From auth middleware
        
        const admin = await Admin.findById(adminId).select(
            'postToFacebook postToInstagram postToYouTube dailySceduleTimeCron username email role lastLoginAt'
        );
        
        if (!admin) {
            return res.status(404).json({
                success: false,
                error: 'Admin not found'
            });
        }

        // Convert cron to time format (HH:mm)
        let dailyScheduleTime = '16:12'; // Default
        if (admin.dailySceduleTimeCron) {
            const parts = admin.dailySceduleTimeCron.split(' ');
            if (parts.length >= 2) {
                const minute = parts[0];
                const hour = parts[1];
                dailyScheduleTime = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
            }
        }

        const settings = {
            username: admin.username,
            email: admin.email,
            role: admin.role,
            lastLoginAt: admin.lastLoginAt,
            postToFacebook: admin.postToFacebook || false,
            postToInstagram: admin.postToInstagram || false,
            postToYouTube: admin.postToYouTube || false,
            dailyScheduleTime: dailyScheduleTime,
            dailySceduleTimeCron: admin.dailySceduleTimeCron
        };

        res.status(200).json({
            success: true,
            data: settings
        });
    } catch (error) {
        logger.error('Error fetching admin settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch settings'
        });
    }
};

/**
 * Update admin settings
 * PUT /api/admin/settings
 * Access: Private (Admin only)
 */
export const updateSettings = async (req, res) => {
    try {
        const adminId = req.admin.id;
        const { postToFacebook, postToInstagram, postToYouTube, dailyScheduleTime } = req.body;

        // Validate dailyScheduleTime format (HH:mm)
        if (dailyScheduleTime && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(dailyScheduleTime)) {
            return res.status(400).json({
                success: false,
                error: 'dailyScheduleTime must be in HH:mm format (24-hour)'
            });
        }

        // Validate boolean values
        if (postToFacebook !== undefined && typeof postToFacebook !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'postToFacebook must be a boolean'
            });
        }
        if (postToInstagram !== undefined && typeof postToInstagram !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'postToInstagram must be a boolean'
            });
        }
        if (postToYouTube !== undefined && typeof postToYouTube !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'postToYouTube must be a boolean'
            });
        }

        // Convert time to cron format if provided
        let dailySceduleTimeCron = null;
        if (dailyScheduleTime) {
            const [hour, minute] = dailyScheduleTime.split(':');
            if (hour && minute) {
                // Format: "minute hour * * *"
                dailySceduleTimeCron = `${parseInt(minute)} ${parseInt(hour)} * * *`;
            }
        }

        // Build update object - only update fields that are provided
        const updateData = {};
        if (postToFacebook !== undefined) updateData.postToFacebook = postToFacebook;
        if (postToInstagram !== undefined) updateData.postToInstagram = postToInstagram;
        if (postToYouTube !== undefined) updateData.postToYouTube = postToYouTube;
        if (dailySceduleTimeCron) updateData.dailySceduleTimeCron = dailySceduleTimeCron;

        // If no fields to update, return error
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid fields to update'
            });
        }

        // Update admin
        const updatedAdmin = await Admin.findByIdAndUpdate(
            adminId,
            updateData,
            {
                new: true,
                runValidators: true,
                select: 'postToFacebook postToInstagram postToYouTube dailySceduleTimeCron username email role'
            }
        );

        if (!updatedAdmin) {
            return res.status(404).json({
                success: false,
                error: 'Admin not found'
            });
        }

        // 🔥 CRITICAL: RESCHEDULE THE JOB IF CRON WAS UPDATED
        if (dailySceduleTimeCron) {
            try {
                logger.info(`🔄 Rescheduling job due to cron update to: ${dailySceduleTimeCron}`);
                const result = await rescheduleDailyVideoJob();
                if (result.success) {
                    logger.info(`✅ Job rescheduled successfully to: ${result.cronExpression}`);
                } else {
                    logger.error('❌ Failed to reschedule job:', result.error);
                }
            } catch (error) {
                logger.error('❌ Error rescheduling job:', error.message);
            }
        }

        // Format response
        const settings = {
            username: updatedAdmin.username,
            email: updatedAdmin.email,
            role: updatedAdmin.role,
            postToFacebook: updatedAdmin.postToFacebook || false,
            postToInstagram: updatedAdmin.postToInstagram || false,
            postToYouTube: updatedAdmin.postToYouTube || false,
            dailyScheduleTime: dailyScheduleTime || '16:12',
            dailySceduleTimeCron: updatedAdmin.dailySceduleTimeCron
        };

        logger.info(`Admin settings updated for user: ${updatedAdmin.username}`);

        res.status(200).json({
            success: true,
            message: 'Settings updated successfully',
            data: settings
        });
    } catch (error) {
        logger.error('Error updating admin settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update settings'
        });
    }
};

/**
 * Get admin settings for a specific admin
 * GET /api/admin/settings/:adminId
 * Access: Private (Admin only)
 */
export const getAdminSettings = async (req, res) => {
    try {
        const { adminId } = req.params;
        
        // Check if requesting admin has permission
        if (req.admin.id !== adminId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. You can only view your own settings.'
            });
        }
        
        const admin = await Admin.findById(adminId).select(
            'username email postToFacebook postToInstagram postToYouTube dailySceduleTimeCron lastLoginAt role'
        );
        
        if (!admin) {
            return res.status(404).json({
                success: false,
                error: 'Admin not found'
            });
        }

        // Convert cron to time format
        let dailyScheduleTime = '16:12';
        if (admin.dailySceduleTimeCron) {
            const parts = admin.dailySceduleTimeCron.split(' ');
            if (parts.length >= 2) {
                const minute = parts[0];
                const hour = parts[1];
                dailyScheduleTime = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
            }
        }

        res.status(200).json({
            success: true,
            data: {
                username: admin.username,
                email: admin.email,
                role: admin.role,
                postToFacebook: admin.postToFacebook || false,
                postToInstagram: admin.postToInstagram || false,
                postToYouTube: admin.postToYouTube || false,
                dailyScheduleTime: dailyScheduleTime,
                dailySceduleTimeCron: admin.dailySceduleTimeCron,
                lastLoginAt: admin.lastLoginAt
            }
        });
    } catch (error) {
        logger.error('Error fetching admin settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch admin settings'
        });
    }
};

/**
 * Get all admins (super admin feature)
 * GET /api/admin/admins
 * Access: Private (Admin only)
 */
export const getAllAdmins = async (req, res) => {
    try {
        const admins = await Admin.find()
            .select('username email postToFacebook postToInstagram postToYouTube dailySceduleTimeCron lastLoginAt createdAt')
            .sort({ createdAt: -1 });

        // Format each admin's settings
        const formattedAdmins = admins.map(admin => {
            let dailyScheduleTime = '16:12';
            if (admin.dailySceduleTimeCron) {
                const parts = admin.dailySceduleTimeCron.split(' ');
                if (parts.length >= 2) {
                    const minute = parts[0];
                    const hour = parts[1];
                    dailyScheduleTime = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
                }
            }

            return {
                id: admin._id,
                username: admin.username,
                email: admin.email,
                postToFacebook: admin.postToFacebook || false,
                postToInstagram: admin.postToInstagram || false,
                postToYouTube: admin.postToYouTube || false,
                dailyScheduleTime: dailyScheduleTime,
                lastLoginAt: admin.lastLoginAt,
                createdAt: admin.createdAt
            };
        });

        res.status(200).json({
            success: true,
            data: formattedAdmins
        });
    } catch (error) {
        logger.error('Error fetching all admins:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch admins'
        });
    }
};

/**
 * Update admin cron schedule only (convenience method)
 * PATCH /api/admin/schedule
 * Access: Private (Admin only)
 */
export const updateSchedule = async (req, res) => {
    try {
        const adminId = req.admin.id;
        const { dailyScheduleTime } = req.body;

        // Validate dailyScheduleTime format (HH:mm)
        if (!dailyScheduleTime || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(dailyScheduleTime)) {
            return res.status(400).json({
                success: false,
                error: 'dailyScheduleTime must be in HH:mm format (24-hour)'
            });
        }

        // Convert time to cron format
        const [hour, minute] = dailyScheduleTime.split(':');
        const dailySceduleTimeCron = `${parseInt(minute)} ${parseInt(hour)} * * *`;

        // Update admin
        const updatedAdmin = await Admin.findByIdAndUpdate(
            adminId,
            { dailySceduleTimeCron },
            {
                new: true,
                runValidators: true,
                select: 'dailySceduleTimeCron username'
            }
        );

        if (!updatedAdmin) {
            return res.status(404).json({
                success: false,
                error: 'Admin not found'
            });
        }

        // 🔥 RESCHEDULE THE JOB
        try {
            logger.info(`🔄 Rescheduling job due to schedule update to: ${dailySceduleTimeCron}`);
            const result = await rescheduleDailyVideoJob();
            if (result.success) {
                logger.info(`✅ Job rescheduled successfully to: ${result.cronExpression}`);
            } else {
                logger.error('❌ Failed to reschedule job:', result.error);
            }
        } catch (error) {
            logger.error('❌ Error rescheduling job:', error.message);
        }

        logger.info(`Schedule updated for ${updatedAdmin.username}: ${dailySceduleTimeCron}`);

        res.status(200).json({
            success: true,
            message: 'Schedule updated successfully',
            data: {
                dailyScheduleTime: dailyScheduleTime,
                dailySceduleTimeCron: dailySceduleTimeCron
            }
        });
    } catch (error) {
        logger.error('Error updating schedule:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update schedule'
        });
    }
};

/**
 * Get current job schedule status
 * GET /api/admin/schedule/status
 * Access: Private (Admin only)
 */
export const getScheduleStatus = async (req, res) => {
    try {
        const admin = await Admin.findById(req.admin.id).select('dailySceduleTimeCron');
        
        let dailyScheduleTime = '16:12';
        if (admin && admin.dailySceduleTimeCron) {
            const parts = admin.dailySceduleTimeCron.split(' ');
            if (parts.length >= 2) {
                const minute = parts[0];
                const hour = parts[1];
                dailyScheduleTime = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
            }
        }

        res.status(200).json({
            success: true,
            data: {
                dailyScheduleTime,
                dailySceduleTimeCron: admin?.dailySceduleTimeCron || '12 16 * * *',
                isScheduled: true
            }
        });
    } catch (error) {
        logger.error('Error getting schedule status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get schedule status'
        });
    }
};