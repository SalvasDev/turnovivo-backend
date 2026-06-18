import { IsString, MinLength, Matches } from 'class-validator';

export class CreateBusinessDto {
  @IsString()
  @MinLength(3, { message: 'El nombre del negocio debe tener al menos 3 caracteres.' })
  readonly name!: string;

  @IsString()
  // Expresión regular que valida formato slug (ej: "barberia-premium-1", solo letras, números y guiones)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'El slug debe ser una cadena válida en minúsculas separada por guiones (ej: barberia-premium).',
  })
  readonly slug!: string;
}
