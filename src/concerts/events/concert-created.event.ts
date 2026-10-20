export const CONCERT_CREATED = 'concert.created';

export interface ConcertCreatedEvent {
  id: string;
  title: string;
  band: string;
  date: Date;
  venue: string;
}