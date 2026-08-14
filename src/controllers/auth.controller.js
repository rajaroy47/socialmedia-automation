// src/controllers/auth.controller.js

import { loginAdmin } from "../services/auth.service.js";
import Admin from "../models/admin.model.js";

export async function login(req, res) {
    try {
        const { identifier, password } = req.body;
        const result = await loginAdmin(identifier, password);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(401).json({ success: false, error: error.message });
    }
}

export async function me(req, res) {
    try {
        const admin = await Admin.findById(req.admin.id).select("-passwordHash");
        if (!admin) {
            return res.status(404).json({ success: false, error: "Admin not found" });
        }
        res.json({ success: true, admin });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
