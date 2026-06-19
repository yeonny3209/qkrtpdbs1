import streamlit as st
import random

# ==========================================
# 1. 홈 화면 페이지
# ==========================================
def home_page():
    st.title("🌟 파이썬 종합 두뇌 게임 허브")
    st.write("원하는 게임을 왼쪽 사이드바 메뉴에서 선택하여 즐겨보세요! 모든 게임은 실시간으로 상태가 저장됩니다.")
    st.divider()
    
    col1, col2 = st.columns(2)
    with col1:
        st.subheader("🧠 두뇌 대결 클래식")
        st.info("**⚫ 오셀로 두뇌 게임:** 상대방의 돌을 감싸 쥐어 내 색깔로 뒤집는 고도의 전략 게임")
        st.info("**🟡 중력 사목 게임:** 중력으로 아래부터 쌓이는 바둑판에서 4개의 돌을 한 줄로 연결하는 게임")
        st.info("**🧱 쿼리도 두뇌 게임:** 벽을 세워 상대를 막고 먼저 반대편 고지에 도달하는 미니멀 게임")
        
    with col2:
        st.subheader("🎲 운과 성장 시뮬레이션")
        st.success("**⚔️ 성장형 던전 RPG:** 몬스터 사냥, 전설 장비 뽑기, 스탯 강화가 가미된 고품질 텍스트 RPG")
        st.success("**🎲 뱀사다리 말판 게임:** 주사위를 굴려 뱀과 사다리를 타고 30번 고지에 먼저 도달하는 게임")
        st.success("**🎮 업다운 게임:** 1부터 100 사이의 숨겨진 숫자를 최소한의 힌트로 맞추는 스피드 게임")

# ==========================================
# 2. 업다운(Up-Down) 숫자 맞추기 게임 페이지
# ==========================================
def game_page():
    st.title("🎮 스피드 업다운 숫자 맞추기")
    st.write("1부터 100 사이에 숨겨진 비밀의 숫자를 맞춰보세요!")

    if "ud_target" not in st.session_state:
        st.session_state.ud_target = random.randint(1, 100)
        st.session_state.ud_count = 0
        st.session_state.ud_msg = "숫자를 입력하고 [정답 확인]을 누르세요."
        st.session_state.ud_win = False

    st.metric("현재 시도 횟수", f"{st.session_state.ud_count} 회")

    if not st.session_state.ud_win:
        user_guess = st.number_input("내가 생각한 숫자:", min_value=1, max_value=100, step=1, key="ud_guess")
        if st.button("🎯 정답 확인", key="ud_btn"):
            st.session_state.ud_count += 1
            if user_guess < st.session_state.ud_target:
                st.session_state.ud_msg = f"🔺 UP! {user_guess}보다 큽니다."
            elif user_guess > st.session_state.ud_target:
                st.session_state.ud_msg = f"🔻 DOWN! {user_guess}보다 작습니다."
            else:
                st.session_state.ud_win = True
                st.session_state.ud_msg = f"🎉 정답입니다! {st.session_state.ud_target}을(를) {st.session_state.ud_count}번 만에 맞추셨습니다!"
        st.info(st.session_state.ud_msg)
    else:
        st.success(st.session_state.ud_msg)
        if st.button("🔄 게임 다시 시작하기"):
            del st.session_state.ud_target
            st.rerun()

# ==========================================
# 3. 뱀사다리 말판 게임 페이지 (미니 30칸 버전)
# ==========================================
def board_page():
    st.title("🎲 뱀사다리 미니 말판 게임")
    st.write("주사위를 굴려 가장 먼저 30번 칸에 도착하면 승리합니다! 사다리를 타면 점프하고, 뱀을 만나면 미끄러집니다.")

    if "sm_pos" not in st.session_state:
        st.session_state.sm_pos = 1
        st.session_state.sm_log = "게임 시작! 주사위를 굴려주세요."
        st.session_state.sm_dice = 0

    ladders = {3: 12, 8: 18, 15: 25}
    snakes = {14: 4, 22: 11, 29: 13}

    c1, c2 = st.columns(2)
    c1.metric("📍 현재 내 위치", f"{st.session_state.sm_pos} 번 칸 / 30")
    c2.metric("🎲 최근 주사위 눈", f"{st.session_state.sm_dice if st.session_state.sm_dice > 0 else '-'}")

    st.info(st.session_state.sm_log)

    if st.session_state.sm_pos < 30:
        if st.button("🎲 주사위 굴리기", use_container_width=True):
            dice = random.randint(1, 6)
            st.session_state.sm_dice = dice
            next_pos = st.session_state.sm_pos + dice
            
            if next_pos >= 30:
                st.session_state.sm_pos = 30
                st.session_state.sm_log = "🏁 축하합니다! 30번 고지에 도달하여 최종 승리했습니다!"
            else:
                st.session_state.sm_pos = next_pos
                st.session_state.sm_log = f"🎲 주사위 {dice}가 나와서 {next_pos}번 칸으로 이동했습니다."
                
                if next_pos in ladders:
                    st.session_state.sm_pos = ladders[next_pos]
                    st.session_state.sm_log += f" 🚀 [사다리 활성!] {ladders[next_pos]}번 칸으로 초고속 워프!"
                elif next_pos in snakes:
                    st.session_state.sm_pos = snakes[next_pos]
                    st.session_state.sm_log += f" 🐍 [뱀에게 물림!] {snakes[next_pos]}번 칸으로 미끄러졌습니다.. ㅜㅜ"
            st.rerun()
    else:
        st.success("🏆 게임 종료! 승리하셨습니다.")
        if st.button("🔄 처음부터 다시 하기"):
            del st.session_state.sm_pos
            st.rerun()

# ==========================================
# 4. 쿼리도(Quoridor) 미니 두뇌 게임 페이지 (오류 수정 완료)
# ==========================================
def quoridor_page():
    st.title("🧱 미니 쿼리도 챌린지")
    st.write("상대방보다 먼저 반대편 끝줄에 도달하면 승리합니다! 내 턴에 움직이거나 장애물(벽)을 배치하세요.")

    if "q_board" not in st.session_state:
        st.session_state.q_board = [[0]*5 for _ in range(5)]
        st.session_state.q_board[0][2] = 1 
        st.session_state.q_board[4][2] = 2 
        st.session_state.q_posA = (0, 2)
        st.session_state.q_posB = (4, 2)
        st.session_state.q_turn = 1 
        st.session_state.q_over = False
        st.session_state.q_msg = "🔵 블루(A) 플레이어 차례입니다. 한 칸 이동하거나 벽을 세우세요."

    board = st.session_state.q_board
    turn = st.session_state.q_turn
    rA, cA = st.session_state.q_posA
    rB, cB = st.session_state.q_posB

    st.subheader(f"현재 턴: {'🔵 블루(A)' if turn == 1 else '🟠 오렌지(B)'}")
    st.info(st.session_state.q_msg)

    for r in range(5):
        cols = st.columns(5)
        for c in range(5):
            val = board[r][c]
            if val == 1:   icon = "🔵"
            elif val == 2: icon = "🟠"
            elif val == 9: icon = "🧱"
            else:          icon = "⬜"
            cols[c].button(icon, key=f"q_{r}_{c}", disabled=True, use_container_width=True)

    st.divider()

    if not st.session_state.q_over:
        ctrl1, ctrl2 = st.columns(2)
        
        with ctrl1:
            st.write("🏃 말 이동하기")
            m_cols = st.columns(4)
            cr, cc = (rA, cA) if turn == 1 else (rB, cB)
            
            if m_cols[0].button("▲ 상", key="mv_u", disabled=cr==0):
                nr, nc = cr-1, cc
                if board[nr][nc] == 0:
                    board[cr][cc] = 0
                    board[nr][nc] = turn
                    if turn == 1: st.session_state.q_posA = (nr, nc)
                    else: st.session_state.q_posB = (nr, nc)
                    
                    if turn == 1 and nr == 4: st.session_state.q_over, st.session_state.q_msg = True, "🏆 블루(A) 플레이어가 남쪽 고지에 선점하여 승리했습니다!"
                    elif turn == 2 and nr == 0: st.session_state.q_over, st.session_state.q_msg = True, "🏆 오렌지(B) 플레이어가 북쪽 고지에 선점하여 승리했습니다!"
                    else:
                        st.session_state.q_turn = 2 if turn == 1 else 1
                        st.session_state.q_msg = "턴이 교체되었습니다."
                    st.rerun()
            
            if m_cols[1].button("▼ 하", key="mv_d", disabled=cr==4):
                nr, nc = cr+1, cc
                if board[nr][nc] == 0:
                    board[cr][cc] = 0
                    board[nr][nc] = turn
                    if turn == 1: st.session_state.q_posA = (nr, nc)
                    else: st.session_state.q_posB = (nr, nc)
                    
                    if turn == 1 and nr == 4: st.session_state.q_over, st.session_state.q_msg = True, "🏆 블루(A) 승리!"
                    elif turn == 2 and nr == 0: st.session_state.q_over, st.session_state.q_msg = True, "🏆 오렌지(B) 승리!"
                    else:
                        st.session_state.q_turn = 2 if turn == 1 else 1
                        st.session_state.q_msg = "턴이 교체되었습니다."
                    st.rerun()

            if m_cols[2].button("◀ 좌", key="mv_l", disabled=cc==0):
                nr, nc = cr, cc-1
                if board[nr][nc] == 0:
                    board[cr][cc] = 0
                    board[nr][nc] = turn
                    if turn == 1: st.session_state.q_posA = (nr, nc)
                    else: st.session_state.q_posB = (nr, nc)
                    st.session_state.q_turn = 2 if turn == 1 else 1
                    st.session_state.q_msg = "턴이 교체되었습니다."
                    st.rerun()

            if m_cols[3].button("▶ 우", key="mv_r", disabled=cc==4):
                nr, nc = cr, cc+1
                if board[nr][nc] == 0:
                    board[cr][cc] = 0
                    board[nr][nc] = turn
                    if turn == 1: st.session_state.q_posA = (nr, nc)
                    else: st.session_state.q_posB = (nr, nc)
                    st.session_state.q_turn = 2 if turn == 1 else 1
                    st.session_state.q_msg = "턴이 교체되었습니다."
                    st.rerun()

        with ctrl2:
            st.write("🧱 장애물 벽 세우기")
            wr = st.selectbox("행 선택(0~4)", list(range(5)), key="w_row")
            wc = st.selectbox("열 선택(0~4)", list(range(5)), key="w_col")
            if st.button("🧱 선택한 좌표에 벽 배치", use_container_width=True):
                if board[wr][wc] == 0: # 기존 버그 수정 완료 (w -> wc)
                    board[wr][wc] = 9
                    st.session_state.q_turn = 2 if turn == 1 else 1
                    st.session_state.q_msg = f"({wr}, {wc}) 좌표에 장벽이 세워졌습니다. 턴이 교체됩니다."
                    st.rerun()
                else:
                    st.error("빈 곳에만 벽을 설치할 수 있습니다!")
    else:
        if st.button("🔄 쿼리도 초기화 후 재시작"):
            del st.session_state.q_board
            st.rerun()

# ==========================================
# 5. 오셀로(Othello) 보드게임 페이지
# ==========================================
def othello_page():
    st.title("⚫ ⚪ 두뇌 리버스 게임: 오셀로")
    st.write("상대방의 돌을 가로, 세로, 대각선으로 감싸 쥐어 내 돌로 뒤집으세요! 더 많은 돌을 남기는 사람이 승리합니다.")

    if "oth_board" not in st.session_state:
        board = [[0] * 8 for _ in range(8)]
        board[3][3], board[4][4] = 2, 2
        board[3][4], board[4][3] = 1, 1
        st.session_state.oth_board = board
        st.session_state.oth_turn = 1  
        st.session_state.oth_msg = "흑(⚫) 플레이어의 차례입니다. 초록색 칸(🟢)에 돌을 놓을 수 있습니다."
        st.session_state.oth_over = False

    board = st.session_state.oth_board
    turn = st.session_state.oth_turn
    directions = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

    def get_flippable_tiles(r, c, player):
        if board[r][c] != 0: return []
        opp = 2 if player == 1 else 1
        tiles_to_flip = []
        for dr, dc in directions:
            nr, nc = r + dr, c + dc
            temp_flip = []
            while 0 <= nr < 8 and 0 <= nc < 8 and board[nr][nc] == opp:
                temp_flip.append((nr, nc))
                nr += dr
                nc += dc
            if 0 <= nr < 8 and 0 <= nc < 8 and board[nr][nc] == player:
                tiles_to_flip.extend(temp_flip)
        return tiles_to_flip

    def get_valid_moves(player):
        moves = {}
        for r in range(8):
            for c in range(8):
                flippable = get_flippable_tiles(r, c, player)
                if flippable: moves[(r, c)] = flippable
        return moves

    valid_moves = get_valid_moves(turn)

    if not valid_moves and not st.session_state.oth_over:
        opp = 2 if turn == 1 else 1
        opp_moves = get_valid_moves(opp)
        if not opp_moves:
            st.session_state.oth_over = True
            st.session_state.oth_msg = "🏁 양쪽 모두 더 이상 둘 곳이 없습니다! 게임 종료."
        else:
            st.session_state.oth_turn = opp
            turn = opp
            valid_moves = opp_moves
            st.session_state.oth_msg = f"🔄 둘 곳이 없어 턴이 패스됩니다! 이제 {'흑(⚫)' if turn == 1 else '백(⚪)'}의 차례입니다."
            st.rerun()

    black_score = sum(row.count(1) for row in board)
    white_score = sum(row.count(2) for row in board)

    sc1, sc2, sc3 = st.columns(3)
    sc1.metric("⚫ 흑돌 개수", f"{black_score}개")
    sc2.metric("⚪ 백돌 개수", f"{white_score}개")
    sc3.metric("현재 차례", "⬛ 흑(⚫)" if turn == 1 else "⬜ 백(⚪)")

    st.info(st.session_state.oth_msg)

    if st.session_state.oth_over:
        if black_score > white_score: st.success(f"🏆 점수 {black_score} 대 {white_score}로 **흑(⚫) 승리!**")
        elif white_score > black_score: st.success(f"🏆 점수 {white_score} 대 {black_score}로 **백(⚪) 승리!**")
        else: st.warning("🤝 무승부입니다!")

    st.divider()

    for r in range(8):
        cols = st.columns(8)
        for c in range(8):
            tile = board[r][c]
            if tile == 1: tile_emoji = "⚫"
            elif tile == 2: tile_emoji = "⚪"
            elif (r, c) in valid_moves and not st.session_state.oth_over: tile_emoji = "🟢"
            else: tile_emoji = " "

            is_clickable = (r, c) in valid_moves and not st.session_state.oth_over
            if cols[c].button(tile_emoji, key=f"oth_{r}_{c}", disabled=not is_clickable, use_container_width=True):
                board[r][c] = turn
                for fr, fc in valid_moves[(r, c)]: board[fr][fc] = turn
                st.session_state.oth_board = board
                st.session_state.oth_turn = 2 if turn == 1 else 1
                st.session_state.oth_msg = f"{'흑(⚫)' if st.session_state.oth_turn == 1 else '백(⚪)'} 플레이어 차례입니다."
                st.rerun()

    st.divider()
    if st.button("🔄 오셀로 게임 리셋"):
        if "oth_board" in st.session_state: del st.session_state.oth_board
        st.rerun()

# ==========================================
# 6. 중력 사목(Connect Four) 게임 페이지
# ==========================================
def connect_four_page():
    st.title("🔴 🟡 중력 사목 게임: Connect Four")
    st.write("원하는 열(Column)의 버튼을 누르면 돌이 중력에 의해 맨 아래 칸부터 차곡차곡 쌓입니다. 4개를 먼저 이어보세요!")

    if "c4_board" not in st.session_state:
        st.session_state.c4_board = [[0] * 7 for _ in range(6)] 
        st.session_state.c4_turn = 1 
        st.session_state.c4_winner = None
        st.session_state.c4_over = False
        st.session_state.c4_msg = "🔴 선공 플레이어의 차례입니다. 상단 버튼을 눌러 돌을 떨어뜨리세요."

    board = st.session_state.c4_board
    turn = st.session_state.c4_turn

    def check_c4_winner():
        for r in range(6):
            for c in range(4):
                if board[r][c] != 0 and board[r][c] == board[r][c+1] == board[r][c+2] == board[r][c+3]: return board[r][c]
        for r in range(3):
            for c in range(7):
                if board[r][c] != 0 and board[r][c] == board[r+1][c] == board[r+2][c] == board[r+3][c]: return board[r][c]
        for r in range(3):
            for c in range(4):
                if board[r][c] != 0 and board[r][c] == board[r+1][c+1] == board[r+2][c+2] == board[r+3][c+3]: return board[r][c]
        for r in range(3, 6):
            for c in range(4):
                if board[r][c] != 0 and board[r][c] == board[r-1][c+1] == board[r-2][c+2] == board[r-3][c+3]: return board[r][c]
        if all(board[0][c] != 0 for c in range(7)): return -1
        return None

    sc1, sc2 = st.columns(2)
    sc1.metric("현재 차례", "🔴 레드" if turn == 1 else "🟡 옐로우")
    
    if st.session_state.c4_over:
        if st.session_state.c4_winner == -1: st.warning("🤝 보드판이 가득 찼습니다! 무승부!")
        else: st.success(f"🏆 {'🔴 레드' if st.session_state.c4_winner == 1 else '🟡 옐로우'} 플레이어 최종 승리!")
    else:
        st.info(st.session_state.c4_msg)

    st.divider()

    drop_cols = st.columns(7)
    for c in range(7):
        is_col_full = board[0][c] != 0
        if drop_cols[c].button(f"👇 {c+1}열", key=f"drop_{c}", disabled=is_col_full or st.session_state.c4_over, use_container_width=True):
            for r in range(5, -1, -1):
                if board[r][c] == 0:
                    board[r][c] = turn
                    break
            winner = check_c4_winner()
            if winner is not None:
                st.session_state.c4_over = True
                st.session_state.c4_winner = winner
            else:
                st.session_state.c4_turn = 2 if turn == 1 else 1
                st.session_state.c4_msg = f"{'🟡 옐로우' if st.session_state.c4_turn == 2 else '🔴  레드'} 플레이어 차례입니다."
            st.session_state.c4_board = board
            st.rerun()

    st.write("") 

    board_html = "<div style='display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; background-color: #1e3a8a; padding: 15px; border-radius: 15px; max-width: 500px; margin: auto; border: 4px solid #172554'>"
    for r in range(6):
        for c in range(7):
            tile = board[r][c]
            if tile == 1:
                ball = "<div style='width: 35px; height: 35px; background: radial-gradient(circle at 30% 30%, #f87171, #dc2626); border-radius: 50%; box-shadow: 1px 2px 4px rgba(0,0,0,0.4);'></div>"
            elif tile == 2:
                ball = "<div style='width: 35px; height: 35px; background: radial-gradient(circle at 30% 30%, #fef08a, #ca8a04); border-radius: 50%; box-shadow: 1px 2px 4px rgba(0,0,0,0.4);'></div>"
            else:
                ball = "<div style='width: 35px; height: 35px; background-color: #3b82f6; border-radius: 50%; opacity: 0.3;'></div>"
            board_html += f"<div style='display: flex; align-items: center; justify-content: center; aspect-ratio: 1;'>{ball}</div>"
    board_html += "</div>"
    st.markdown(board_html, unsafe_allow_html=True)

    st.divider()
    if st.button("🔄 사목 게임판 완전히 리셋"):
        if "c4_board" in st.session_state: del st.session_state.c4_board
        st.rerun()

# ==========================================
# 7. 고품질 성장형 던전 RPG 게임 페이지 (밸런스 업그레이드)
# ==========================================
def rpg_page():
    st.title("⚔️ 무한 루프 무한 성장 RPG")
    st.write("몬스터를 무찌르고 전설적인 장비를 수집하며 한계를 극복하는 고품질 텍스트 RPG 시뮬레이터입니다.")

    # 세션 데이터 완전 초기화
    if "rpg_hero" not in st.session_state:
        st.session_state.rpg_hero = {
            "레벨": 1, "경험치": 0, "골드": 150, "기본공격력": 10, "장비공격력": 0,
            "체력": 100, "최대체력": 100, "무기이름": "훈련용 목검 (일반)", "강화수치": 0
        }
        st.session_state.rpg_log = "⚔️ 환영합니다 모험가님! 아래 명령을 내려 모험을 시작하십시오."

    hero = st.session_state.rpg_hero
    total_atk = hero["기본공격력"] + hero["장비공격력"]

    # 대시보드 스탯 창 구성
    stat1, stat2, stat3, stat4 = st.columns(4)
    stat1.metric("🏅 영웅 레벨", f"Lv. {hero['레벨']}", f"EXP {hero['경험치']}/100")
    stat2.metric("❤️ 생명력 (HP)", f"{hero['체력']} / {hero['최대체력']}")
    stat3.metric("⚔️ 총 공격력", f"{total_atk}", f"장비 +{hero['장비공격력']}")
    stat4.metric("💰 보유 자금", f"{hero['골드']} G")

    st.code(f"🛡️ 현재 착용 무기: {hero['무기이름']} (+{hero['강화수치']} 강화)", language="text")
    st.info(st.session_state.rpg_log)

    st.subheader("🕹️ 모험단 행동 명령")
    act_cols = st.columns(4)

    # 1. 사냥터 기능
    if act_cols[0].button("🐉 차원 균열 사냥터 진입", use_container_width=True):
        if hero["체력"] <= 15:
            st.session_state.rpg_log = "❌ [경고] 체력이 부족합니다! 여관에서 안전하게 휴식을 취하세요."
        else:
            # 적 스펙 생성 및 전투 연산
            monster_names = ["돌연변이 슬라임", "고블린 정찰병", "심연의 스켈레톤", "지옥 가고일"]
            mon = random.choice(monster_names)
            
            # 공격력에 따라 받는 피해 감소 및 처치 효율 증가
            dmg_taken = max(5, random.randint(15, 30) - (total_atk // 5))
            gold_gain = random.randint(20, 50) + (hero["레벨"] * 2)
            exp_gain = random.randint(25, 40)

            hero["체력"] -= dmg_taken
            hero["골드"] += gold_gain
            hero["경험치"] += exp_gain

            log = f"⚔️ [{mon}]을(를) 격파했습니다! 피해: -{dmg_taken}HP | 전리품: +{gold_gain}G, +{exp_gain}EXP"

            # 레벨업 판정
            if hero["경험치"] >= 100:
                hero["레벨"] += 1
                hero["경험치"] = max(0, hero["경험치"] - 100)
                hero["기본공격력"] += 4
                hero["최대체력"] += 15
                hero["체력"] = hero["최대체력"] # 완치
                log += f"\n✨ [LEVEL UP!] Lv.{hero['레벨']}(으)로 성장했습니다! 스탯 증가 및 체력 완전 회복!"

            st.session_state.rpg_log = log
        st.rerun()

    # 2. 휴식 기능
    if act_cols[1].button("🏡 포근한 여관 휴식 (-20G)", use_container_width=True):
        if hero["골드"] >= 20:
            hero["골드"] -= 20
            hero["체력"] = hero["최대체력"]
            st.session_state.rpg_log = "💤 따뜻한 수프와 침대 덕분에 피로가 완전히 가셨습니다! (HP 100% 회복)"
        else:
            st.session_state.rpg_log = "❌ 골드가 부족하여 여관에서 쫓겨났습니다. 몬스터를 더 잡으세요."
        st.rerun()

    # 3. 장비 뽑기 보물상자
    if act_cols[2].button("🎁 고대 장비 상자 뽑기 (-80G)", use_container_width=True):
        if hero["골드"] >= 80:
            hero["골드"] -= 80
            
            # 장비 티어 랜덤 가챠
            rand_val = random.random()
            if rand_val < 0.05: # 5%
                hero["무기이름"] = "🔥 신화의 파멸 대검"
                hero["장비공격력"] = 50
                st.session_state.rpg_log = "등급: [神話] 🔴 미라클! 붉은 빛의 전설을 뛰어넘는 최고의 대검을 뽑았습니다!! (공격력 +50)"
            elif rand_val < 0.20: # 15%
                hero["무기이름"] = "✨ 드래곤 슬레이어 장검"
                hero["장비공격력"] = 25
                st.session_state.rpg_log = "등급: [전설] 🟡 심장이 웅장해지는 고대의 용 사냥꾼 검을 획득했습니다! (공격력 +25)"
            elif rand_val < 0.55: # 35%
                hero["무기이름"] = "🔷 기사단의 강철 기검"
                hero["장비공격력"] = 12
                st.session_state.rpg_log = "등급: [희귀] 🔵 단단하게 제련된 정예 기사용 장검을 장착했습니다. (공격력 +12)"
            else:
                hero["무기이름"] = "🪵 무디어진 녹슨 철검"
                hero["장비공격력"] = 4
                st.session_state.rpg_log = "등급: [일반] 🟢 평범하디 평범한 무기를 건졌습니다. (공격력 +4)"
            
            hero["강화수치"] = 0 # 새 무기는 강철 강화도 초기화
        else:
            st.session_state.rpg_log = "❌ 골드가 모자라 장비 상자를 열지 못했습니다. (비용: 80 G)"
        st.rerun()

    # 4. 장비 주문서 주문 강화
    up_cost = 30 + (hero["강화수치"] * 15)
    if act_cols[3].button(f"⚒️ 장비 주문서 강화 (-{up_cost}G)", use_container_width=True):
        if hero["골드"] >= up_cost:
            hero["골드"] -= up_cost
            
            # 확률형 강화 시스템 적용
            success_rate = max(0.2, 1.0 - (hero["강화수치"] * 0.1))
            if random.random() < success_rate:
                hero["강화수치"] += 1
                hero["장비공격력"] += 3
                st.session_state.rpg_log = f"⚒️ [강화 성공] 짜릿한 불꽃과 함께 무기가 더욱 예리해집니다! (+{hero['강화수치']} 강화 달성)"
            else:
                st.session_state.rpg_log = "💥 [강화 실패] 주문서의 빛이 흐려지며 강화에 실패했습니다. (장비 파괴는 면했습니다!)"
        else:
            st.session_state.rpg_log = f"❌ 무기 강화 비용({up_cost} G)이 부족합니다."
        st.rerun()

    st.divider()
    if st.button("🔄 전설의 영웅으로 전생 (데이터 초기화)"):
        if "rpg_hero" in st.session_state: del st.session_state.rpg_hero
        st.rerun()

# ==========================================
# 8. 메인 네비게이션 진입 게이트웨이
# ==========================================
st.set_page_config(
    page_title="종합 게임 허브 스트림릿",
    page_icon="🌟",
    layout="wide"
)

# 각각의 페이지 오브젝트 맵핑
home = st.Page(home_page, title="홈 화면", icon="🌟")
game = st.Page(game_page, title="업다운 게임", icon="🎮")
board = st.Page(board_page, title="뱀사다리 말판 게임", icon="🎲")
quoridor = st.Page(quoridor_page, title="쿼리도 두뇌 게임", icon="🧱")
othello = st.Page(othello_page, title="오셀로 두뇌 게임", icon="⚫")
c4_game = st.Page(connect_four_page, title="중력 사목 게임", icon="🟡")
rpg = st.Page(rpg_page, title="성장형 RPG 게임", icon="⚔️")

# 내비게이션 바 바인딩
pg = st.navigation([home, game, board, quoridor, othello, c4_game, rpg])
pg.run()
