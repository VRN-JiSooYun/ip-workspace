import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { AllowAnonymous, Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { CreateQuantumCalculationDto } from './dto/create-quantum-calculation.dto';
import { ThreeDPsaCallbackDto } from './dto/three-d-psa-callback.dto';
import { QuantumCalculationService } from './quantum-calculation.service';

@Controller('api/calculations/3d-psa')
export class QuantumCalculationController {
  constructor(private readonly service: QuantumCalculationService) {}

  @Post('jobs')
  createJobs(@Session() session: UserSession, @Body() body: CreateQuantumCalculationDto) {
    return this.service.createJobs(session.user.id, body);
  }

  @Get('jobs')
  getJobs(
    @Session() session: UserSession,
    @Query('compoundDraftKey') compoundDraftKey: string,
  ) {
    return this.service.getJobs(session.user.id, compoundDraftKey);
  }

  @Get('jobs/:jobId')
  getJob(
    @Session() session: UserSession,
    @Param('jobId', new ParseUUIDPipe({ version: '4' })) jobId: string,
  ) {
    return this.service.getJob(session.user.id, jobId);
  }

  @AllowAnonymous()
  @Post('callback')
  @HttpCode(200)
  receiveCallback(@Body() body: ThreeDPsaCallbackDto) {
    return this.service.receiveCallback(body);
  }
}
