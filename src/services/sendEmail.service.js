// src/services/sendEmail.sevice.js

import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const sendEmail = async (sendTo, subject, body)=>{
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        tls: {
            rejectUnauthorized: false // Bypasses the certificate check
        }
    });

    const mailOptions = {
        from: 'rajaroy6297818984@gmail.com', 
        to: sendTo,              
        subject: subject,            
        html: body,    
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Success! Message ID:', info.messageId);
    } catch (error) {
        console.error('SMTP Connection Failed:', error);
    }
}

export default sendEmail;