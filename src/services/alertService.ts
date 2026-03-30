import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export const sendCaregiverAlert = async (
  caregiverEmail: string,
  userName: string,
  explanation: string
) => {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: caregiverEmail,
      subject: `⚠️ CogniScreen Alert for ${userName}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #f59e0b; padding: 20px; text-align: center;">
            <h2 style="color: white; margin: 0;">⚠️ High Risk Alert</h2>
          </div>
          <div style="padding: 20px;">
            <p style="font-size: 16px;">Hello,</p>
            <p style="font-size: 16px;">We are writing to alert you regarding <strong>${userName}</strong>.</p>
            <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
              <strong>Observation:</strong> ${explanation}
            </div>
            <p style="font-size: 16px;">Please check in with them today to ensure their well-being.</p>
            <p style="font-size: 16px; margin-top: 30px;">Warmly,<br/>The CogniScreen Team</p>
          </div>
          <div style="background-color: #f9fafb; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #eee;">
            Sent by CogniScreen &mdash; Dementia Early Detection System
          </div>
        </div>
      `,
    })

    if (error) {
      console.error('Resend alert failed:', error)
      return
    }

    console.log(`✅ Caregiver alert sent to ${caregiverEmail}`)
  } catch (err) {
    console.error('Resend alert failed:', err)
    // Don't throw — alert failure should never crash the main flow
  }
}
