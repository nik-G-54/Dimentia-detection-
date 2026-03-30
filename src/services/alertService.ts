import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

export const sendCaregiverAlert = async (
  caregiverPhone: string,
  userName: string,
  explanation: string
) => {
  try {
    await client.messages.create({
      body: `⚠️ CogniScreen Alert for ${userName}: ${explanation}. Please check in with them today.`,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: caregiverPhone,
    })
    console.log(`✅ Caregiver alert sent to ${caregiverPhone}`)
  } catch (err) {
    console.error('Twilio alert failed:', err)
    // Don't throw — alert failure should never crash the main flow
  }
}
