import { IsUUID, IsDateString } from 'class-validator';

export class CreateSlotDto {
  @IsUUID('4', { message: 'El businessId debe ser un UUID v4 válido.' })
  readonly businessId!: string;

  @IsDateString({}, { message: 'La fecha de inicio debe ser un formato ISO válido.' })
  readonly startTime!: string;

  @IsDateString({}, { message: 'La fecha de fin debe ser un formato ISO válido.' })
  readonly endTime!: string;
}
