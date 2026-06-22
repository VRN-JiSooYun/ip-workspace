import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { GenerateConformerDto } from './dto/generate-conformer.dto';

export interface ConformerResponse {
  generation_method?: string;
  energy?: number;
  conformer: string;
  format: 'sdf';
}

@Injectable()
export class ConformerService {
  private readonly apiUrl: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = this.configService.get<string>(
      'conformer.apiUrl',
      'http://172.16.1.203:8000',
    );
    this.timeoutMs = this.configService.get<number>('conformer.timeoutMs', 120000);
  }

  async generateConformer(body: GenerateConformerDto): Promise<ConformerResponse> {
    const smiles = body.smiles?.trim();
    if (!smiles) {
      throw new BadRequestException('SMILES is required.');
    }

    const payload = {
      smiles,
      generation_methods: body.generation_methods ?? ['ETKDGv3'],
      max_attempts: body.max_attempts ?? 1000,
      num_confs: body.num_confs ?? 3,
      optimization_method: body.optimization_method ?? 'MMFF94s',
      max_iters: body.max_iters ?? 1000,
      return_format: body.return_format ?? 'sdf',
      random_seed: body.random_seed ?? 0,
    };

    try {
      const response = await this.httpService.axiosRef.post<ConformerResponse>(
        `${this.apiUrl.replace(/\/$/, '')}/3dconformer`,
        payload,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: this.timeoutMs,
        },
      );

      const data = response.data;
      if (!data?.conformer || data.format !== 'sdf') {
        throw new BadGatewayException('Invalid conformer API response.');
      }

      return data;
    } catch (error) {
      if (error instanceof BadGatewayException || error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof Error) {
        throw new BadGatewayException({
          message: 'Failed to generate 3D conformer.',
          detail: error.message,
        });
      }
      throw new BadGatewayException('Failed to generate 3D conformer.');
    }
  }
}
