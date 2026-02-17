// src/lib/emailService.ts
import emailjs from '@emailjs/browser';

/**
 * Service to handle email notifications using EmailJS
 */

interface EmailParams {
    to_email: string;
    to_name: string;
    subject: string;
    message: string;
    [key: string]: any; // Allow for extra custom template variables
}

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

const isConfigured = () => {
    return SERVICE_ID && SERVICE_ID !== 'YOUR_SERVICE_ID' &&
        TEMPLATE_ID && TEMPLATE_ID !== 'YOUR_TEMPLATE_ID' &&
        PUBLIC_KEY && PUBLIC_KEY !== 'YOUR_PUBLIC_KEY';
};

/**
 * Generic send function
 */
export const sendEmail = async (params: EmailParams) => {
    console.log('📧 Preparing to send email:', params);

    if (!isConfigured()) {
        console.warn('⚠️ EmailJS credentials missing or not configured in .env. Notification logged to console only.');
        return { status: 200, text: 'MOCKED_OK' };
    }

    try {
        const response = await emailjs.send(
            SERVICE_ID,
            TEMPLATE_ID,
            {
                ...params
            },
            PUBLIC_KEY
        );
        console.log('✅ Email sent successfully:', response);
        return response;
    } catch (error) {
        console.error('❌ Failed to send email:', error);
        throw error;
    }
};

/**
 * Specific: Welcome Email for new users
 */
export const sendWelcomeEmail = async (email: string, name: string) => {
    return sendEmail({
        to_email: email,
        to_name: name,
        subject: 'Welcome to SCRAP LINK!',
        message: `Hi ${name},\n\nWelcome to SCRAP LINK! We're excited to have you on board. Start listing your scrap or finding the best deals today.`
    });
};

/**
 * Specific: Login Notification
 */
export const sendLoginNotificationEmail = async (email: string, name: string) => {
    return sendEmail({
        to_email: email,
        to_name: name,
        subject: 'New Login Detected - SCRAP LINK',
        message: `Hi ${name},\n\nA new login was detected for your account on SCRAP LINK at ${new Date().toLocaleString()}.\n\nIf this was not you, please reset your password immediately.`
    });
};

/**
 * Specific: New Pickup Request Notification for Sellers
 */
export const sendNewPickupRequestEmail = async (sellerEmail: string, sellerName: string, scrapType: string, recyclerName: string, pickupSlot?: string) => {
    let slotInfo = pickupSlot ? `\n\nPreferred Pickup Slot: ${pickupSlot}` : '';
    return sendEmail({
        to_email: sellerEmail,
        to_name: sellerName,
        subject: 'New Pickup Request Received!',
        message: `Hi ${sellerName},\n\nYou have received a new pickup request from ${recyclerName} for your ${scrapType} scrap listing.${slotInfo}\n\nPlease check your dashboard to accept or reject the request.`
    });
};

/**
 * Specific: Pickup Slot scheduled for Recyclers
 */
export const sendPickupSlotEmail = async (params: {
    to_email: string;
    to_name: string;
    from_name: string;
    scrap_type: string;
    weight: number;
    pickup_slot: string;
}) => {
    return sendEmail({
        to_email: params.to_email,
        to_name: params.to_name,
        subject: 'Your Pickup has been Scheduled!',
        message: `Great news! Your pickup request for ${params.scrap_type} scrap (${params.weight}kg) has been accepted.\n\nScheduled Pickup Slot: ${params.pickup_slot}\n\nAccepted by: ${params.from_name}`
    });
};

/**
 * Specific: Pickup Request Confirmation for Recyclers (Customers)
 */
export const sendPickupRequestConfirmationEmail = async (recyclerEmail: string, recyclerName: string, scrapType: string, pickupSlot?: string) => {
    let slotInfo = pickupSlot ? `\n\nYour Preferred Pickup Slot: ${pickupSlot}` : '';
    return sendEmail({
        to_email: recyclerEmail,
        to_name: recyclerName,
        subject: 'Pickup Request Confirmation - SCRAP LINK',
        message: `Hi ${recyclerName},\n\nYour pickup request for ${scrapType} has been successfully submitted.${slotInfo}\n\nThe seller will review your request and confirm the pickup slot. You will be notified once they respond.\n\nThank you for using SCRAP LINK!`
    });
};

