import { NodemailerEmailService } from '../../src/services/NodemailerEmailService';
import type { Transporter } from 'nodemailer';

describe('NodemailerEmailService', () => {
  let mockSendMail: jest.Mock;
  let mockTransporter: Transporter;
  let service: NodemailerEmailService;

  beforeEach(() => {
    mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
    mockTransporter = { sendMail: mockSendMail } as unknown as Transporter;
    service = new NodemailerEmailService(mockTransporter);
  });

  it('calls sendMail with correct fields when no attachment', async () => {
    await service.send({
      from: 'me@example.com',
      to: 'hr@example.com',
      subject: 'Test Subject',
      text: 'Test body',
    });

    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'me@example.com',
      to: 'hr@example.com',
      subject: 'Test Subject',
      text: 'Test body',
      attachments: [],
    });
  });

  it('includes attachment when provided', async () => {
    const content = Buffer.from([1, 2, 3]);
    await service.send({
      from: 'me@example.com',
      to: 'hr@example.com',
      subject: 'Timesheet',
      text: 'See attached',
      attachment: { filename: 'timesheet.pdf', content },
    });

    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'me@example.com',
      to: 'hr@example.com',
      subject: 'Timesheet',
      text: 'See attached',
      attachments: [{ filename: 'timesheet.pdf', content }],
    });
  });

  it('propagates errors thrown by sendMail', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP connection refused'));

    await expect(
      service.send({ from: 'me@example.com', to: 'hr@example.com', subject: 'x', text: 'y' }),
    ).rejects.toThrow('SMTP connection refused');
  });
});
