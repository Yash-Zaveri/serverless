const sgMail = require("@sendgrid/mail");
const dotenv = require("dotenv");
const winston = require("winston");
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

// Load environment variables
dotenv.config();

const region = process.env.AWS_REGION || "us-east-1";
const secretsManagerClient = new SecretsManagerClient({ region });

// Configure logging with Winston
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} - ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "email_service.log" }),
  ],
});

// Function to fetch the SendGrid API key from AWS Secrets Manager
const getSendGridApiKey = async () => {
  try {
    const command = new GetSecretValueCommand({
      SecretId: "email-service-credentials",
    });
    const response = await secretsManagerClient.send(command);

    if (response.SecretString) {
      const secret = JSON.parse(response.SecretString);
      return secret.SENDGRID_API_KEY;
    } else if (response.SecretBinary) {
      const buff = Buffer.from(response.SecretBinary, "base64");
      return buff.toString("ascii");
    }
  } catch (error) {
    logger.error("Error fetching SendGrid API key:", error);
    throw new Error("Failed to fetch SendGrid API key from Secrets Manager");
  }
};

// Function to send verification emails
const sendVerificationEmail = async (email, verificationToken, baseURL) => {
  if (!email || !verificationToken || !baseURL) {
    logger.error("Missing email, verification token, or base URL");
    throw new Error("Invalid parameters for sending email");
  }

  const verificationLink = `https://${baseURL}/user/v1/user/self/verify?token=${verificationToken}`;
  const msg = {
    to: email,
    from: `noreply@${baseURL}`,
    subject: "CSYE6225 Webapp - Verify Your Email",
    html: `<p>Dear User,<br>Please verify your email by <a href="${verificationLink}">clicking here</a>. This link expires in 2 minutes.<br><br>Thanks, <br>Yash Zaveri</p>`,
  };

  logger.info(`Prepared email for ${email} with verification link: ${verificationLink}`);

  try {
    const response = await sgMail.send(msg);
    logger.info(`Email sent to ${email} successfully: ${JSON.stringify(response)}`);
    return response;
  } catch (error) {
    logger.error(`Failed to send email to ${email}: ${error}`);
    throw error;
  }
};

// Lambda handler
const handler = async (event) => {
  logger.info("Handler triggered for email verification");

  try {
    const sendGridApiKey = await getSendGridApiKey();
    sgMail.setApiKey(sendGridApiKey);

    const baseURL = process.env.BASE_URL;
    for (const record of event.Records) {
      const snsMessage = JSON.parse(record.Sns.Message);
      const { email, verificationToken } = snsMessage;

      try {
        await sendVerificationEmail(email, verificationToken, baseURL);
      } catch (error) {
        logger.error(`Error while processing email for ${email}: ${error}`);
      }
    }

    logger.info("All emails processed successfully");
    return {
      statusCode: 200,
      body: "Verification email sent successfully",
    };
  } catch (error) {
    logger.error(`Handler error: ${error}`);
    return {
      statusCode: 500,
      body: "An error occurred",
    };
  }
};

module.exports = { getSendGridApiKey, sendVerificationEmail, handler };
