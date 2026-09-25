import { fitSize } from '../src/webparts/pmoPortal/logic/image';

test('маленький снимок не меняется', () => expect(fitSize(1280, 800, 1920)).toEqual({ w: 1280, h: 800 }));
test('широкий — по ширине', () => expect(fitSize(3840, 2160, 1920)).toEqual({ w: 1920, h: 1080 }));
test('снимок телефона (портрет) — по высоте', () => expect(fitSize(1179, 2556, 1920)).toEqual({ w: 886, h: 1920 }));
