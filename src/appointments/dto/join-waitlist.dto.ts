import { IsUUID } from 'class-validator';

export class JoinWaitlistDto {
  @IsUUID('4', { message: 'El slotId debe ser un UUID v4 válido.' })
  readonly slotId!: string;
}