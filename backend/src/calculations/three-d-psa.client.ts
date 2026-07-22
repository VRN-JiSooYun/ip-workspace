import { BadGatewayException, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { RequestedQuantumJobType } from './dto/create-quantum-calculation.dto';

type ThreeDPsaSubmissionResponse = {
  result_code?: unknown;
  result?: unknown;
};

@Injectable()
export class ThreeDPsaClient {
  private readonly apiUrl: string;
  private readonly callbackUrl: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = this.configService.get<string>(
      'threeDPsa.apiUrl',
      'http://172.16.1.130:20010',
    );
    this.callbackUrl = this.configService.get<string>(
      'threeDPsa.callbackUrl',
      'http://172.16.1.183:18082/api/calculations/3d-psa/callback',
    );
    this.timeoutMs = this.configService.get<number>('threeDPsa.submitTimeoutMs', 10000);
  }

  async submit(input: {
    externalKey: string;
    smiles: string;
    jobType: RequestedQuantumJobType;
  }): Promise<void> {
    const form = new URLSearchParams({
      unique_key: input.externalKey,
      smiles: input.smiles,
      job_type: input.jobType,
      callback_url: this.callbackUrl,
    });

    try {
      const response = await this.httpService.axiosRef.post<ThreeDPsaSubmissionResponse>(
        `${this.apiUrl.replace(/\/$/, '')}/api/3dpsa`,
        form.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: this.timeoutMs,
        },
      );
      if (response.data?.result_code !== '0000') {
        throw new BadGatewayException({
          message: '3D PSA calculation request was rejected.',
          detail: typeof response.data?.result === 'string'
            ? response.data.result
            : `RESULT_CODE_${String(response.data?.result_code ?? 'UNKNOWN')}`,
        });
      }
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      const axiosError = error as AxiosError;
      throw new BadGatewayException({
        message: 'Failed to request 3D PSA calculation.',
        detail: axiosError.message,
      });
    }
  }
}
