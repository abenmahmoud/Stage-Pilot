import { sendTransactionalEmail, sendTransactionalSms } from './brevo.js';
import { buildIdentityVerificationEmail } from '../../shared/school-email-templates.mjs';
import { identityDeviceCode } from './identity-device-access.js';

export async function deliverIdentityCode(input: { challengeId: string; contactType: 'email' | 'phone'; contact: string; firstName: string }): Promise<void> {
  const code = identityDeviceCode(input.challengeId);
  if (input.contactType === 'phone') {
    await sendTransactionalSms({ recipient: input.contact,
      content: `Lycée Blaise Cendrars : ${code}. Valable 10 min. Ne le partagez pas.`, tag: 'lyceegest-identity' });
  } else {
    await sendTransactionalEmail({ to: { email: input.contact, name: input.firstName },
      ...buildIdentityVerificationEmail({ firstName: input.firstName, code }),
      idempotencyKey: `identity-device-${input.challengeId}`, tags: ['lyceegest-identity'] });
  }
}
