-- الفسيفساء الكبرى الأولى: خارطة مادبا، 24 جزءاً (6×4)، لكل جزء 16 قطعة. الصورة من Wikimedia Commons.
insert into public.grand_mosaics (slug, title_ar, summary_ar, image_path, credit, license, license_url, source_url, width, height, cols, rows, piece_grid)
values ('madaba-map', 'خارطة مادبا', 'جزء من أرضية فسيفسائية في كنيسة القديس جاورجيوس البيزنطية المبكرة في مادبا.', '/media/visual/grand-madaba.jpg', 'Bashar Tabbah', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Madaba_Map_(Church).jpg', 2500, 1667, 6, 4, 4)
on conflict (slug) do nothing;
