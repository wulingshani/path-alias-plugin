import { BaseService } from '@/global/BaseService';

export class DemoService extends BaseService {
  greet(): string {
    return `hello from ${this.kind}`;
  }
}
