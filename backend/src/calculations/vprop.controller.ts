import { Body, Controller, Post } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { PredictVpropDto } from './dto/predict-vprop.dto';
import { VpropService } from './vprop.service';

@Controller('api/calculations/vprop')
export class VpropController {
  constructor(private readonly service: VpropService) {}

  @Post('predict')
  predict(@Session() _session: UserSession, @Body() body: PredictVpropDto) {
    return this.service.predict(body);
  }
}
