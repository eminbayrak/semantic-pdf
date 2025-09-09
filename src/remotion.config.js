import { Config } from '@remotion/cli/config';

// Video Configuration
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');
Config.setCrf(18);
Config.setVideoBitrate('2M');

// Audio Configuration
Config.setAudioBitrate('128k');
Config.setAudioCodec('aac');
Config.setAudioSampleRate(44100);
Config.setAudioChannels(2);

// Performance Configuration
Config.setImageSequence(false);
Config.setConcurrency(1);
Config.setTimeoutInMilliseconds(30000);