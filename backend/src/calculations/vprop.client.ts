import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import type { VpropPredictResponse } from './types/vprop.types';

@Injectable()
export class VpropClient {
  private readonly apiUrl: string;
  private readonly timeoutMs: number;
  private readonly maxResponseBytes: number;

  constructor(
    private readonly httpService: HttpService,
    configService: ConfigService,
  ) {
    this.apiUrl = configService.get<string>('vprop.apiUrl', 'http://172.16.1.207:8100');
    this.timeoutMs = configService.get<number>('vprop.timeoutMs', 25000);
    this.maxResponseBytes = configService.get<number>('vprop.maxResponseBytes', 5242880);
  }

  async predict(smiles: string): Promise<VpropPredictResponse> {
    try {
      const response = await this.httpService.axiosRef.post<VpropPredictResponse>(
        `${this.apiUrl.replace(/\/$/, '')}/predict`,
        { smiles, method: 'rdkit' },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: this.timeoutMs,
          maxBodyLength: 1024 * 1024,
          maxContentLength: this.maxResponseBytes,
        },
      );
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
        throw new GatewayTimeoutException({ message: 'VPROP_TIMEOUT' });
      }
      throw new BadGatewayException({
        message: 'VPROP_REQUEST_FAILED',
        detail: axiosError.response?.status
          ? `UPSTREAM_STATUS_${axiosError.response.status}`
          : axiosError.code || 'UPSTREAM_UNAVAILABLE',
      });
    }
  }
}
