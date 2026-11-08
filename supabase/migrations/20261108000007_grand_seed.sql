-- الفسيفساء الكبرى الأولى: خارطة مادبا، 24 جزءاً (6×4)، لكل جزء 16 قطعة. الصورة من Wikimedia Commons.
insert into public.grand_mosaics (slug, title_ar, summary_ar, image_path, credit, license, license_url, source_url, width, height, cols, rows, piece_grid)
values ('madaba-map', 'خارطة مادبا', 'جزء من أرضية فسيفسائية في كنيسة القديس جاورجيوس البيزنطية المبكرة في مادبا.', '/media/visual/grand-madaba.jpg', 'Carole Raddato from FRANKFURT, Germany', 'CC BY-SA 2.0', 'https://creativecommons.org/licenses/by-sa/2.0', 'https://commons.wikimedia.org/wiki/File:The_Madaba_Map,_part_of_a_floor_mosaic_in_the_early_Byzantine_church_of_Saint_George_depicting_the_Holy_Land_in_the_6th_century_AD,_Madaba,_Jordan_(33798361303).jpg', 3200, 2120, 6, 4, 4)
on conflict (slug) do nothing;
