import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common";
import { PATENT_CODE_TYPES, type PatentCodeType } from "./patent-code.service";

/** `:type` path param을 허용 목록으로 좁힌다. 임의의 문자열이 service까지 가지 않는다. */
@Injectable()
export class ParsePatentCodeTypePipe implements PipeTransform<
  string,
  PatentCodeType
> {
  transform(value: string): PatentCodeType {
    if ((PATENT_CODE_TYPES as readonly string[]).includes(value)) {
      return value as PatentCodeType;
    }
    throw new BadRequestException("PATENT_CODE_TYPE_INVALID");
  }
}
