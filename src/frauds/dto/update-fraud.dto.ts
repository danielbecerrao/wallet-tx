import { PartialType } from '@nestjs/mapped-types';
import { CreateFraudDto } from './create-fraud.dto';

export class UpdateFraudDto extends PartialType(CreateFraudDto) {}
