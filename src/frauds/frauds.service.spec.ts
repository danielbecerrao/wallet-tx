import { Test, TestingModule } from '@nestjs/testing';
import { FraudsService } from './frauds.service';

describe('FraudsService', () => {
  let service: FraudsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FraudsService],
    }).compile();

    service = module.get<FraudsService>(FraudsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
