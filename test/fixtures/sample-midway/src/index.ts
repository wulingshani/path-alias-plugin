import { DemoService } from '@/modules/demo/service';

const svc = new DemoService();
process.stdout.write(svc.greet());
