<?php
    error_reporting(E_ERROR | E_PARSE);

    // PUT ADDRESS TO HERE! -----------------------------------
    $siteUrl = "http://ppek.hu/";
    $outdir = "converter-out";
    // --------------------------------------------------------

    $content = file_get_contents($siteUrl . 'ppekcim.htm');

    $dom = new DOMDocument('1.0', 'UTF-8');
    $dom->loadHTML('<?xml encoding="utf-8"?>' . $content);

    $xpath = new DOMXpath($dom);
    $elements = $xpath->query("//table//a[text()]");

    mkdir($outdir);

    $limit = 10;

    foreach ($elements as $key => $value) {
        $relpath = $value->getAttributeNode("href")->value;
        
        echo("------------------------------------ " . $relpath . " ----------------------------------------\n");
        $bookContent = file_get_contents($siteUrl . $relpath);
        $bookContent = mb_convert_encoding($bookContent, 'html-entities', "UTF-8");

        $bookPage = new DOMDocument();
        $bookPage->loadHTML($bookContent);

        $titleWithAuthor = getElemText($bookPage, "/html/body/table[1]//td[2]");
        $twaArr = explode(":", $titleWithAuthor, 2);
        if (sizeof($twaArr) > 1) {
            $title = to_bare_text($twaArr[1]);
            $author = to_bare_text($twaArr[0]);
        } else {
            $title = to_bare_text($twaArr[0]);
            $author = "Ismeretlen";
        }
        $fullidnum = getElemText($bookPage, "/html/body/table[1]/tbody/tr/td[3]/b");
        $idnum = trim(explode(":", $fullidnum)[1]);

        $bodyText = getElemText($bookPage, "/html/body");
        $description = get_description(to_bare_text(($bodyText)));
        $urlTable = getLinks($siteUrl, $bookPage);

        // -----------------------------------
        echo("Title: " . $title . "\n");
        echo("Author: " . $author . "\n");
        echo("Description: " . $description . "\n");
        foreach ($urlTable as $key => $value) {
            echo(" [" . $key . "] " . $value . "\n");
        }

        // -----------------------------------
        $filename = urlize($title) . ".md";
        $fp = fopen($outdir . "/" . $filename, 'w');
        fwrite($fp, '---' . "\n");
        fwrite($fp, 'title: ' . $title . "\n");
        fwrite($fp, 'authors:' . "\n");
        fwrite($fp, '  - ' . $author . "\n");
        fwrite($fp, 'ppeknum: ' . $idnum . "\n");
        fwrite($fp, 'download-urls: ' . "\n");
        foreach ($urlTable as $key => $value) {
            fwrite($fp, '  - ' . $key . ": " . $value . "\n");
        }
        fwrite($fp, '---' . "\n");
        fwrite($fp, $description . "\n");

        fclose($fp);


        if ($limit > 0 && $key > $limit) {
            break;
        }
    };

    function getLinks($siteUrl, $page) {
        $x = (new DOMXPath($page))->query("/html/body/table[2]//tr//a");
        $ret = [];
        for ($i=0; $i < $x->length; $i++) {
            if ($i % 2 == 0) {
                $type = $x[$i]->textContent;
                $url = $siteUrl . $x[$i]->attributes["href"]->textContent;
                $ret[$type] = $url;
            }
        }
        return $ret;        
    }

    function getElemText($elem, $path, $which = 0) {
        $x = (new DOMXPath($elem))->query($path);
        return trim($x->item($which)->textContent);
    }

    function get_description($bodyText) {
        preg_match_all('/.*PPEK szám: [0-9]+ (.*?)Kattintson/', $bodyText, $output_array);
        return $output_array[1][0];
    }

    function to_bare_text($string) {
        $string = trim($string);
        $string = preg_replace('/[\r\t\n]/', ' ', $string);
        $string = preg_replace('/\xc2\xa0/', ' ', $string);
        $string = preg_replace('/\s+/', ' ', $string);
        return $string;
    }

    function urlize($string) {
        $string = remove_accents($string);
        // E.g.: Some title - with some subtitle
        // E.g.: Some title: some subtitle
        $string = preg_replace('/[\s\.:!?„"”\(\)\';,\[\]]/', '-', $string);
        return trim(preg_replace('/-+/', '-', $string), "-");
    }

    // This is an older WordPress implementation
    function remove_accents($string) {
        if ( !preg_match('/[\x80-\xff]/', $string) )
            return $string;
    
        $chars = array(
        // Decompositions for Latin-1 Supplement
        chr(195).chr(128) => 'A', chr(195).chr(129) => 'A',
        chr(195).chr(130) => 'A', chr(195).chr(131) => 'A',
        chr(195).chr(132) => 'A', chr(195).chr(133) => 'A',
        chr(195).chr(135) => 'C', chr(195).chr(136) => 'E',
        chr(195).chr(137) => 'E', chr(195).chr(138) => 'E',
        chr(195).chr(139) => 'E', chr(195).chr(140) => 'I',
        chr(195).chr(141) => 'I', chr(195).chr(142) => 'I',
        chr(195).chr(143) => 'I', chr(195).chr(145) => 'N',
        chr(195).chr(146) => 'O', chr(195).chr(147) => 'O',
        chr(195).chr(148) => 'O', chr(195).chr(149) => 'O',
        chr(195).chr(150) => 'O', chr(195).chr(153) => 'U',
        chr(195).chr(154) => 'U', chr(195).chr(155) => 'U',
        chr(195).chr(156) => 'U', chr(195).chr(157) => 'Y',
        chr(195).chr(159) => 's', chr(195).chr(160) => 'a',
        chr(195).chr(161) => 'a', chr(195).chr(162) => 'a',
        chr(195).chr(163) => 'a', chr(195).chr(164) => 'a',
        chr(195).chr(165) => 'a', chr(195).chr(167) => 'c',
        chr(195).chr(168) => 'e', chr(195).chr(169) => 'e',
        chr(195).chr(170) => 'e', chr(195).chr(171) => 'e',
        chr(195).chr(172) => 'i', chr(195).chr(173) => 'i',
        chr(195).chr(174) => 'i', chr(195).chr(175) => 'i',
        chr(195).chr(177) => 'n', chr(195).chr(178) => 'o',
        chr(195).chr(179) => 'o', chr(195).chr(180) => 'o',
        chr(195).chr(181) => 'o', chr(195).chr(182) => 'o',
        chr(195).chr(182) => 'o', chr(195).chr(185) => 'u',
        chr(195).chr(186) => 'u', chr(195).chr(187) => 'u',
        chr(195).chr(188) => 'u', chr(195).chr(189) => 'y',
        chr(195).chr(191) => 'y',
        // Decompositions for Latin Extended-A
        chr(196).chr(128) => 'A', chr(196).chr(129) => 'a',
        chr(196).chr(130) => 'A', chr(196).chr(131) => 'a',
        chr(196).chr(132) => 'A', chr(196).chr(133) => 'a',
        chr(196).chr(134) => 'C', chr(196).chr(135) => 'c',
        chr(196).chr(136) => 'C', chr(196).chr(137) => 'c',
        chr(196).chr(138) => 'C', chr(196).chr(139) => 'c',
        chr(196).chr(140) => 'C', chr(196).chr(141) => 'c',
        chr(196).chr(142) => 'D', chr(196).chr(143) => 'd',
        chr(196).chr(144) => 'D', chr(196).chr(145) => 'd',
        chr(196).chr(146) => 'E', chr(196).chr(147) => 'e',
        chr(196).chr(148) => 'E', chr(196).chr(149) => 'e',
        chr(196).chr(150) => 'E', chr(196).chr(151) => 'e',
        chr(196).chr(152) => 'E', chr(196).chr(153) => 'e',
        chr(196).chr(154) => 'E', chr(196).chr(155) => 'e',
        chr(196).chr(156) => 'G', chr(196).chr(157) => 'g',
        chr(196).chr(158) => 'G', chr(196).chr(159) => 'g',
        chr(196).chr(160) => 'G', chr(196).chr(161) => 'g',
        chr(196).chr(162) => 'G', chr(196).chr(163) => 'g',
        chr(196).chr(164) => 'H', chr(196).chr(165) => 'h',
        chr(196).chr(166) => 'H', chr(196).chr(167) => 'h',
        chr(196).chr(168) => 'I', chr(196).chr(169) => 'i',
        chr(196).chr(170) => 'I', chr(196).chr(171) => 'i',
        chr(196).chr(172) => 'I', chr(196).chr(173) => 'i',
        chr(196).chr(174) => 'I', chr(196).chr(175) => 'i',
        chr(196).chr(176) => 'I', chr(196).chr(177) => 'i',
        chr(196).chr(178) => 'IJ',chr(196).chr(179) => 'ij',
        chr(196).chr(180) => 'J', chr(196).chr(181) => 'j',
        chr(196).chr(182) => 'K', chr(196).chr(183) => 'k',
        chr(196).chr(184) => 'k', chr(196).chr(185) => 'L',
        chr(196).chr(186) => 'l', chr(196).chr(187) => 'L',
        chr(196).chr(188) => 'l', chr(196).chr(189) => 'L',
        chr(196).chr(190) => 'l', chr(196).chr(191) => 'L',
        chr(197).chr(128) => 'l', chr(197).chr(129) => 'L',
        chr(197).chr(130) => 'l', chr(197).chr(131) => 'N',
        chr(197).chr(132) => 'n', chr(197).chr(133) => 'N',
        chr(197).chr(134) => 'n', chr(197).chr(135) => 'N',
        chr(197).chr(136) => 'n', chr(197).chr(137) => 'N',
        chr(197).chr(138) => 'n', chr(197).chr(139) => 'N',
        chr(197).chr(140) => 'O', chr(197).chr(141) => 'o',
        chr(197).chr(142) => 'O', chr(197).chr(143) => 'o',
        chr(197).chr(144) => 'O', chr(197).chr(145) => 'o',
        chr(197).chr(146) => 'OE',chr(197).chr(147) => 'oe',
        chr(197).chr(148) => 'R',chr(197).chr(149) => 'r',
        chr(197).chr(150) => 'R',chr(197).chr(151) => 'r',
        chr(197).chr(152) => 'R',chr(197).chr(153) => 'r',
        chr(197).chr(154) => 'S',chr(197).chr(155) => 's',
        chr(197).chr(156) => 'S',chr(197).chr(157) => 's',
        chr(197).chr(158) => 'S',chr(197).chr(159) => 's',
        chr(197).chr(160) => 'S', chr(197).chr(161) => 's',
        chr(197).chr(162) => 'T', chr(197).chr(163) => 't',
        chr(197).chr(164) => 'T', chr(197).chr(165) => 't',
        chr(197).chr(166) => 'T', chr(197).chr(167) => 't',
        chr(197).chr(168) => 'U', chr(197).chr(169) => 'u',
        chr(197).chr(170) => 'U', chr(197).chr(171) => 'u',
        chr(197).chr(172) => 'U', chr(197).chr(173) => 'u',
        chr(197).chr(174) => 'U', chr(197).chr(175) => 'u',
        chr(197).chr(176) => 'U', chr(197).chr(177) => 'u',
        chr(197).chr(178) => 'U', chr(197).chr(179) => 'u',
        chr(197).chr(180) => 'W', chr(197).chr(181) => 'w',
        chr(197).chr(182) => 'Y', chr(197).chr(183) => 'y',
        chr(197).chr(184) => 'Y', chr(197).chr(185) => 'Z',
        chr(197).chr(186) => 'z', chr(197).chr(187) => 'Z',
        chr(197).chr(188) => 'z', chr(197).chr(189) => 'Z',
        chr(197).chr(190) => 'z', chr(197).chr(191) => 's'
        );
    
        $string = strtr($string, $chars);
    
        return $string;
    }
?>