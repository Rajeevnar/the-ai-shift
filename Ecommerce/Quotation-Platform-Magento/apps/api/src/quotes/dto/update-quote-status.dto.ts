import { IsIn } from 'class-validator';

// draft is deliberately excluded here — a quote only ever starts as draft
// (set at creation) and never goes back to it through this endpoint.
export class UpdateQuoteStatusDto {
  @IsIn(['sent', 'accepted', 'declined', 'expired'])
  status!: 'sent' | 'accepted' | 'declined' | 'expired';
}
