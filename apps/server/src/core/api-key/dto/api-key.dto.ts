import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiKeyScope } from '../api-key.constants';

export class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsIn(Object.values(ApiKeyScope))
  scope?: ApiKeyScope;

  /** La expiración es obligatoria: rotar llaves es parte del diseño. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}

export class RevokeApiKeyDto {
  @IsUUID()
  apiKeyId: string;
}
