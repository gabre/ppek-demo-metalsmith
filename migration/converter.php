<?php
    error_reporting(E_ERROR | E_PARSE);

    // PUT ADDRESS TO HERE! -----------------------------------
    $siteUrl = "http://ppek.hu/";
    // --------------------------------------------------------

    $content = file_get_contents($siteUrl . 'ppekcim.htm');

    $dom = new DOMDocument('1.0', 'UTF-8');
    $dom->loadHTML('<?xml encoding="utf-8"?>' . $content);

    $xpath = new DOMXpath($dom);
    $elements = $xpath->query("//table//a[text()]");

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
            $title = $twaArr[1];
            $author = $twaArr[0];
        } else {
            $title = $twaArr[0];
            $author = "Ismeretlen";
        }

        $description = getElemText($bookPage, "/html/body/text()", 1);
        $urlTable = getLinks($bookPage);

        // -----------------------------------
        echo("Title: " . $title . "\n");
        echo("Author: " . $author . "\n");
        echo("Description: " . $description . "\n");
        foreach ($urlTable as $key => $value) {
            echo(" [" . $key . "] " . $value . "\n");
        }


        if ($key > $limit) {
            break;
        }
    };

    function getLinks($page) {
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
?>