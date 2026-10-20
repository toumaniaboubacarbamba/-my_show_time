import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string) {
    if (!/^[a-f\d]{24}$/i.test(value)) {
      throw new BadRequestException('Identifiant invalide');
    }
    return value;
  }
}