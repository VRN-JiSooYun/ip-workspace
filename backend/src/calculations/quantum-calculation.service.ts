import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import {
  CreateQuantumCalculationDto,
  RequestedQuantumJobType,
} from './dto/create-quantum-calculation.dto';
import { ThreeDPsaCallbackDto } from './dto/three-d-psa-callback.dto';
import { ThreeDPsaClient } from './three-d-psa.client';
import {
  buildThreeDPsaUniqueKey,
  isSupportedThreeDPsaUniqueKey,
  THREE_D_PSA_UNIQUE_KEY_PREFIX,
} from './three-d-psa-key';

type CalculationJobRecord = {
  id: string;
  compoundDraftKey: string;
  jobType: RequestedQuantumJobType;
  smiles: string;
  status: 'SUBMITTING' | 'QUEUED' | 'COMPLETED' | 'FAILED';
  resultData: unknown;
  errorMessage: string | null;
  requestedAt: Date;
  completedAt: Date | null;
};

@Injectable()
export class QuantumCalculationService {
  private readonly uniqueKeyPrefix: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: ThreeDPsaClient,
    configService: ConfigService,
  ) {
    this.uniqueKeyPrefix = configService.get<string>(
      'threeDPsa.uniqueKeyPrefix',
      THREE_D_PSA_UNIQUE_KEY_PREFIX,
    );
  }

  async createJobs(userId: string, body: CreateQuantumCalculationDto) {
    const smiles = body.smiles.trim();
    const compoundDraftKey = body.compoundDraftKey.trim();
    if (!smiles || !compoundDraftKey) {
      throw new BadRequestException('compoundDraftKey and smiles are required.');
    }
    const createdJobs = await this.prisma.client.$transaction(
      body.jobTypes.map((jobType) => this.prisma.client.calculationJob.create({
        data: {
          userId,
          compoundDraftKey,
          jobType,
          externalKey: buildThreeDPsaUniqueKey(this.uniqueKeyPrefix),
          smiles,
          status: 'SUBMITTING',
        },
      })),
    );

    const jobs = await Promise.all(createdJobs.map(async (job) => {
      try {
        await this.client.submit({
          externalKey: job.externalKey,
          smiles,
          jobType: job.jobType as RequestedQuantumJobType,
        });
        await this.prisma.client.calculationJob.updateMany({
          where: { id: job.id, status: 'SUBMITTING' },
          data: { status: 'QUEUED', errorMessage: null },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '3D_PSA_SUBMISSION_FAILED';
        await this.prisma.client.calculationJob.updateMany({
          where: { id: job.id, status: 'SUBMITTING' },
          data: {
            status: 'FAILED',
            errorMessage: message,
            completedAt: new Date(),
          },
        });
      }
      return await this.prisma.client.calculationJob.findUniqueOrThrow({
        where: { id: job.id },
      });
    }));

    return { jobs: jobs.map((job) => this.serializeJob(job as CalculationJobRecord)) };
  }

  async getJobs(userId: string, compoundDraftKey: string) {
    if (typeof compoundDraftKey !== 'string' || !compoundDraftKey.trim()) {
      throw new BadRequestException('compoundDraftKey is required.');
    }
    const jobs = await this.prisma.client.calculationJob.findMany({
      where: {
        userId,
        compoundDraftKey: compoundDraftKey.trim(),
        deletedAt: null,
      },
      orderBy: { requestedAt: 'desc' },
    });
    return { jobs: jobs.map((job) => this.serializeJob(job as CalculationJobRecord)) };
  }

  async getJob(userId: string, jobId: string) {
    const job = await this.prisma.client.calculationJob.findFirst({
      where: { id: jobId, userId, deletedAt: null },
    });
    if (!job) throw new NotFoundException('CALCULATION_JOB_NOT_FOUND');
    return this.serializeJob(job as CalculationJobRecord);
  }

  async receiveCallback(body: ThreeDPsaCallbackDto) {
    const externalKey = body.unique_key.trim();
    if (!isSupportedThreeDPsaUniqueKey(externalKey, this.uniqueKeyPrefix)) {
      throw new BadRequestException('INVALID_CALCULATION_UNIQUE_KEY');
    }
    const jobType = body.job_type.trim().toUpperCase();
    if (
      jobType !== RequestedQuantumJobType.PSA
      && jobType !== RequestedQuantumJobType.ESOL
    ) {
      throw new BadRequestException('INVALID_CALCULATION_JOB_TYPE');
    }
    const job = await this.prisma.client.calculationJob.findFirst({
      where: {
        externalKey,
        jobType: jobType as RequestedQuantumJobType,
        deletedAt: null,
      },
    });
    if (!job) throw new NotFoundException('CALCULATION_JOB_NOT_FOUND');

    const callbackReceivedAt = new Date();
    const externalJobId = body.job_id?.trim() || null;
    const externalStatus = body.status.trim().toLowerCase();
    if (
      job.status === 'COMPLETED'
      || (job.status === 'FAILED' && externalStatus !== 'completed')
    ) {
      return { result_code: '0000', result: 'OK' };
    }

    if (externalStatus === 'completed') {
      const resultData = this.normalizeResultData(body.result_data);
      await this.prisma.client.calculationJob.updateMany({
        where: { id: job.id, status: { not: 'COMPLETED' } },
        data: resultData === null
          ? {
              status: 'FAILED',
              externalJobId,
              callbackReceivedAt,
              completedAt: callbackReceivedAt,
              errorMessage: 'INVALID_RESULT_DATA',
            }
          : {
              status: 'COMPLETED',
              externalJobId,
              callbackReceivedAt,
              completedAt: callbackReceivedAt,
              resultData: { value: resultData } as never,
              errorMessage: null,
            },
      });
    } else {
      await this.prisma.client.calculationJob.updateMany({
        where: { id: job.id, status: { not: 'COMPLETED' } },
        data: {
          status: 'FAILED',
          externalJobId,
          callbackReceivedAt,
          completedAt: callbackReceivedAt,
          errorMessage:
            body.error_message?.trim()
            || `UNKNOWN_STATUS_${externalStatus || 'EMPTY'}`,
        },
      });
    }

    return { result_code: '0000', result: 'OK' };
  }

  private normalizeResultData(rawValue: string | undefined): unknown | null {
    const value = rawValue?.trim();
    if (!value) return null;
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) return numericValue;
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  }

  private serializeJob(job: CalculationJobRecord) {
    return {
      id: job.id,
      compoundDraftKey: job.compoundDraftKey,
      jobType: job.jobType,
      smiles: job.smiles,
      status: job.status,
      resultData: job.resultData,
      errorMessage: job.errorMessage,
      requestedAt: job.requestedAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
    };
  }
}
