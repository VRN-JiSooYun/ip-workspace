import { Body, Controller, Post } from "@nestjs/common";
import { SkipTimeout } from "../common/decorators/skip-timeout.decorator";
import { ConformerService } from "./conformer.service";
import { GenerateConformerDto } from "./dto/generate-conformer.dto";

@Controller("api/3d-conformer")
export class ConformerController {
  constructor(private readonly conformerService: ConformerService) {}

  @Post()
  @SkipTimeout()
  generateConformer(@Body() body: GenerateConformerDto) {
    return this.conformerService.generateConformer(body);
  }
}
