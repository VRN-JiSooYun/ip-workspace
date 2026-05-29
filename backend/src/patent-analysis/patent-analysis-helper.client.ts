import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import FormData = require('form-data');
import {
  PatentAnalysisFormPayload,
  PatentAnalysisHelperResult,
} from './types/patent-analysis-helper.types';

@Injectable()
export class PatentAnalysisHelperClient {
  private readonly helperApiUrl: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.helperApiUrl = this.configService.get<string>(
      'patentAnalysis.helperApiUrl',
      'http://172.16.1.210:10130',
    );
    this.timeoutMs = this.configService.get<number>('httpTimeoutMs', 30000);
  }

  async call<T>(payload: PatentAnalysisFormPayload): Promise<T> {
    const form = new FormData();

    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      form.append(key, String(value));
    });

    try {
      const response = await this.httpService.axiosRef.post<
        PatentAnalysisHelperResult<T>
      >(`${this.helperApiUrl.replace(/\/$/, '')}/api`, form, {
        headers: form.getHeaders(),
        timeout: this.timeoutMs,
      });

      const data = response.data;
      if (!data || typeof data !== 'object') {
        throw new BadGatewayException('Invalid patent analysis API response');
      }

      if (data.result_code && data.result_code !== '0000') {
        throw new BadGatewayException({
          message: 'Patent analysis API returned an error',
          detail: data.result,
          resultCode: data.result_code,
        });
      }

      return (data.result ?? data) as T;
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }
      if (error instanceof Error) {
        throw new BadGatewayException({
          message: 'Failed to call patent analysis API',
          detail: error.message,
        });
      }
      throw new InternalServerErrorException('Unknown patent analysis API error');
    }
  }

  async download(payload: PatentAnalysisFormPayload) {
    const form = new FormData();

    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      form.append(key, String(value));
    });

    try {
      return await this.httpService.axiosRef.post(
        `${this.helperApiUrl.replace(/\/$/, '')}/api`,
        form,
        {
          headers: form.getHeaders(),
          responseType: 'stream',
          timeout: this.timeoutMs,
        },
      );
    } catch (error) {
      if (error instanceof Error) {
        throw new BadGatewayException({
          message: 'Failed to download file from patent analysis API',
          detail: error.message,
        });
      }
      throw new InternalServerErrorException('Unknown patent analysis download error');
    }
  }
}
